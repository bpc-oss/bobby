import type { Evidence, KernelEvent, PlanStep } from '@bobby/shared';

export type StreamItem =
  | { kind: 'line'; text: string }
  | { kind: 'tool'; event: Extract<KernelEvent, { type: 'tool_called' }> }
  | { kind: 'evidence'; evidence: Evidence }
  | { kind: 'assistant_delta'; taskId: string; text: string }
  | { kind: 'reasoning_delta'; taskId: string; text: string }
  | { kind: 'tool_delta'; taskId: string; text: string };

type StreamChunk = {
  sequence: number;
  order: number;
  content: string;
};

type StreamChunkBuckets = Record<string, StreamChunk[]>;

type DeltaLine = {
  taskId: string;
  sequence: number;
  content: string;
};

export interface VM {
  lines: string[];
  items: StreamItem[];
  status: 'idle' | 'running' | 'done' | 'failed' | 'blocked';
  goal?: string;
  currentTaskId?: string;
  currentActivity?: string;
  streamingMode: 'event' | 'sse';
  currentPlan: PlanStep[];
  planSteps: string[];
  activeSteps: string[];
  spentUsd?: number;
  proCalls?: number;
  flashCalls?: number;
  contextPercent?: number;
  usageModel?: string;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  costUsd?: number;
  pendingGate?: {
    gateId: string;
    reason: string;
  };
  assistantDeltaBuckets: StreamChunkBuckets;
  reasoningDeltaBuckets: StreamChunkBuckets;
  toolDeltaBuckets: StreamChunkBuckets;
}

export const initialVM = (): VM => ({
  lines: [],
  items: [],
  status: 'idle',
  streamingMode: 'event',
  currentPlan: [],
  planSteps: [],
  activeSteps: [],
  assistantDeltaBuckets: {},
  reasoningDeltaBuckets: {},
  toolDeltaBuckets: {}
});

const appendLine = (vm: VM, text: string): VM => ({
  ...vm,
  lines: [...vm.lines, text],
  items: [...vm.items, { kind: 'line', text }]
});

const appendTextLine = (vm: VM, text: string): VM => ({
  ...vm,
  lines: [...vm.lines, text]
});

const rememberTask = (vm: VM, taskId: string): VM => ({
  ...vm,
  currentTaskId: taskId
});

const normalizeSequence = (sequence: number | undefined): number => {
  if (typeof sequence === 'number' && Number.isFinite(sequence) && sequence >= 0) {
    return sequence;
  }
  return Number.MAX_SAFE_INTEGER;
};

const addChunk = (buckets: StreamChunkBuckets, taskId: string, line: DeltaLine): StreamChunkBuckets => {
  const existingChunks = buckets[taskId] ?? [];
  const nextChunk = { sequence: line.sequence, order: existingChunks.length, content: line.content };
  const nextChunks = [...existingChunks, nextChunk].sort((a, b) => {
    if (a.sequence === b.sequence) {
      return a.order - b.order;
    }
    return a.sequence - b.sequence;
  });

  return {
    ...buckets,
    [taskId]: nextChunks
  };
};

const joinChunks = (chunks: StreamChunk[], separator = ''): string => chunks.map((chunk) => chunk.content).join(separator);

const replaceTaskStreamItem = (
  items: StreamItem[],
  item: Extract<StreamItem, { kind: 'assistant_delta' | 'reasoning_delta' | 'tool_delta' }>
): StreamItem[] => {
  const existingIndex = items.findIndex((existingItem) => {
    return (
      existingItem.kind === item.kind &&
      'taskId' in existingItem &&
      existingItem.taskId === item.taskId
    );
  });

  if (existingIndex < 0) {
    return [...items, item];
  }

  return items.map((existingItem, index) => (index === existingIndex ? item : existingItem));
};

const reduceIntent = (vm: VM, e: Extract<KernelEvent, { type: 'intent_proposed' }>): VM => {
  return { ...rememberTask(vm, e.taskId), goal: e.contract.goal, status: 'running' as const };
};

const reducePlan = (vm: VM, e: Extract<KernelEvent, { type: 'plan_ready' }>): VM => ({
  ...rememberTask(vm, e.taskId),
  currentPlan: e.steps,
  planSteps: e.steps.map((step) => step.id),
  currentActivity: 'planning'
});

const reduceStep = (vm: VM, e: Extract<KernelEvent, { type: 'step_started' }>): VM => ({
  ...rememberTask(vm, e.taskId),
  pendingGate: undefined,
  status: 'running',
  activeSteps: [...vm.activeSteps, e.stepId],
  currentActivity: `step:${e.stepId}`
});

const reduceTool = (vm: VM, e: Extract<KernelEvent, { type: 'tool_called' }>): VM => ({
  ...rememberTask(vm, e.taskId),
  currentActivity: `tool:${e.tool}`,
  items: [...vm.items, { kind: 'tool', event: e }],
  assistantDeltaBuckets: vm.assistantDeltaBuckets,
  reasoningDeltaBuckets: vm.reasoningDeltaBuckets,
  toolDeltaBuckets: vm.toolDeltaBuckets
});

const reduceEvidence = (vm: VM, e: Extract<KernelEvent, { type: 'evidence_produced' }>): VM => ({
  ...rememberTask(vm, e.taskId),
  items: [...vm.items, { kind: 'evidence', evidence: e.evidence }],
  assistantDeltaBuckets: vm.assistantDeltaBuckets,
  reasoningDeltaBuckets: vm.reasoningDeltaBuckets,
  toolDeltaBuckets: vm.toolDeltaBuckets
});

const finalStatusLabel: Record<string, string> = { done: 'Done.', failed: 'Failed.', blocked: 'Blocked.' };

const reduceFinal = (vm: VM, e: Extract<KernelEvent, { type: 'final_result' }>): VM =>
  appendLine(
    {
      ...rememberTask(vm, e.taskId),
      pendingGate: undefined,
      status: e.status,
      currentActivity: undefined
    },
    finalStatusLabel[e.status] ?? e.status
  );

const setStreamingModeSse = (vm: VM): VM => ({ ...vm, streamingMode: 'sse' as const });

const reduceAssistantDelta = (vm: VM, e: Extract<KernelEvent, { type: 'assistant_delta' }>): VM => {
  const nextBuckets = addChunk(vm.assistantDeltaBuckets, e.taskId, {
    taskId: e.taskId,
    sequence: normalizeSequence(e.sequence),
    content: e.content
  });
  const content = joinChunks(nextBuckets[e.taskId] ?? []);
  const vmWithState = setStreamingModeSse(rememberTask(vm, e.taskId));
  const vmWithBuckets = { ...vmWithState, assistantDeltaBuckets: nextBuckets };
  const withLine = appendTextLine(vmWithBuckets, content);
  return {
    ...withLine,
    items: replaceTaskStreamItem(withLine.items, { kind: 'assistant_delta', taskId: e.taskId, text: content })
  };
};

const reduceReasoningDelta = (vm: VM, e: Extract<KernelEvent, { type: 'reasoning_delta' }>): VM => {
  const nextBuckets = addChunk(vm.reasoningDeltaBuckets, e.taskId, {
    taskId: e.taskId,
    sequence: normalizeSequence(e.sequence),
    content: e.content
  });
  const content = joinChunks(nextBuckets[e.taskId] ?? []);
  const vmWithState = setStreamingModeSse(rememberTask(vm, e.taskId));
  const vmWithBuckets = { ...vmWithState, reasoningDeltaBuckets: nextBuckets };
  const withLine = appendTextLine(vmWithBuckets, content);
  return {
    ...withLine,
    items: replaceTaskStreamItem(withLine.items, {
      kind: 'reasoning_delta',
      taskId: e.taskId,
      text: content
    })
  };
};

const formatToolDeltaLine = (event: Extract<KernelEvent, { type: 'tool_delta' }>): string => {
  const parts: string[] = [event.status];
  if (event.tool) {
    parts.push(event.tool);
  }
  if (event.content) {
    parts.push(event.content);
  }
  return parts.join(' ');
};

const reduceToolDelta = (vm: VM, e: Extract<KernelEvent, { type: 'tool_delta' }>): VM => {
  const nextBuckets = addChunk(vm.toolDeltaBuckets, e.taskId, {
    taskId: e.taskId,
    sequence: normalizeSequence(e.sequence),
    content: formatToolDeltaLine(e)
  });
  const content = joinChunks(nextBuckets[e.taskId] ?? [], ' ');
  const vmWithState = setStreamingModeSse(rememberTask(vm, e.taskId));
  const vmWithBuckets = { ...vmWithState, toolDeltaBuckets: nextBuckets };
  const withLine = appendTextLine(vmWithBuckets, content);
  return {
    ...withLine,
    currentActivity: `tool:${e.tool ?? e.status}`,
    items: replaceTaskStreamItem(withLine.items, { kind: 'tool_delta', taskId: e.taskId, text: content })
  };
};

const reduceUsageDelta = (vm: VM, e: Extract<KernelEvent, { type: 'usage_delta' }>): VM => ({
  ...setStreamingModeSse(rememberTask(vm, e.taskId)),
  usageModel: e.model ?? vm.usageModel,
  promptTokens: e.promptTokens ?? vm.promptTokens,
  completionTokens: e.completionTokens ?? vm.completionTokens,
  cachedTokens: e.cachedTokens ?? vm.cachedTokens,
  costUsd: e.costUsd ?? vm.costUsd
});

export function reduceEvent(vm: VM, e: KernelEvent): VM {
  switch (e.type) {
    case 'intent_proposed':
      return reduceIntent(vm, e);
    case 'direct_answer':
      return appendLine(rememberTask(vm, e.taskId), e.text);
    case 'plan_ready':
      return reducePlan(vm, e);
    case 'step_started':
      return reduceStep(vm, e);
    case 'tool_called':
      return reduceTool(vm, e);
    case 'verdict': {
      if (e.verdict.result !== 'pass') {
        return appendLine(rememberTask(vm, e.taskId), `${e.verdict.acId}: ${e.verdict.result}`);
      }
      return rememberTask(vm, e.taskId);
    }
    case 'evidence_produced':
      return reduceEvidence(vm, e);
    case 'assistant_delta':
      return reduceAssistantDelta(vm, e);
    case 'reasoning_delta':
      return reduceReasoningDelta(vm, e);
    case 'tool_delta':
      return reduceToolDelta(vm, e);
    case 'usage_delta':
      return reduceUsageDelta(vm, e);
    case 'gate_request': {
      const pendingGate = { gateId: e.gateId, reason: e.reason };
      return { ...rememberTask(vm, e.taskId), pendingGate, currentActivity: 'waiting:permission' };
    }
    case 'final_result':
      return reduceFinal(vm, e);
    case 'error':
      return appendLine({ ...rememberTask(vm, e.taskId), pendingGate: undefined }, e.message);
    default:
      return vm;
  }
}
