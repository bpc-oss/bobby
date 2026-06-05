import type { Evidence, KernelEvent, PlanStep } from '@bobby/shared';

export type StreamItem =
  | { kind: 'line'; text: string }
  | { kind: 'tool'; event: Extract<KernelEvent, { type: 'tool_called' }> }
  | { kind: 'evidence'; evidence: Evidence };

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
  pendingGate?: {
    gateId: string;
    reason: string;
  };
}

export const initialVM = (): VM => ({
  lines: [],
  items: [],
  status: 'idle',
  streamingMode: 'event',
  currentPlan: [],
  planSteps: [],
  activeSteps: []
});

const appendLine = (vm: VM, text: string): VM => ({
  ...vm,
  lines: [...vm.lines, text],
  items: [...vm.items, { kind: 'line', text }]
});

const rememberTask = (vm: VM, taskId: string): VM => ({
  ...vm,
  currentTaskId: taskId
});

const reduceIntent = (vm: VM, e: Extract<KernelEvent, { type: 'intent_proposed' }>): VM => {
  const next = { ...rememberTask(vm, e.taskId), goal: e.contract.goal, status: 'running' as const };
  return appendLine(next, `goal: ${e.contract.goal}`);
};

const reducePlan = (vm: VM, e: Extract<KernelEvent, { type: 'plan_ready' }>): VM => {
  const next = {
    ...rememberTask(vm, e.taskId),
    currentPlan: e.steps,
    planSteps: e.steps.map((step) => step.id),
    currentActivity: 'planning'
  };
  return appendLine(next, `plan: ${e.steps.length} steps (${e.steps.map((s) => s.id).join(', ')})`);
};

const reduceStep = (vm: VM, e: Extract<KernelEvent, { type: 'step_started' }>): VM =>
  appendLine(
    {
      ...rememberTask(vm, e.taskId),
      status: 'running',
      activeSteps: [...vm.activeSteps, e.stepId],
      currentActivity: `step:${e.stepId}`
    },
    `step: ${e.stepId}`
  );

const reduceTool = (vm: VM, e: Extract<KernelEvent, { type: 'tool_called' }>): VM => ({
  ...appendLine(rememberTask(vm, e.taskId), `tool: ${e.tool}`),
  currentActivity: `tool:${e.tool}`,
  items: [...vm.items, { kind: 'line', text: `tool: ${e.tool}` }, { kind: 'tool', event: e }]
});

const reduceEvidence = (vm: VM, e: Extract<KernelEvent, { type: 'evidence_produced' }>): VM => {
  const text = `evidence: ${e.evidence.acId}/${e.evidence.evidenceType}`;
  return {
    ...appendLine(rememberTask(vm, e.taskId), text),
    items: [...vm.items, { kind: 'line', text }, { kind: 'evidence', evidence: e.evidence }]
  };
};

const reduceFinal = (vm: VM, e: Extract<KernelEvent, { type: 'final_result' }>): VM =>
  appendLine(
    { ...rememberTask(vm, e.taskId), status: e.status, currentActivity: undefined },
    `status: ${e.status}`
  );

export function reduceEvent(vm: VM, e: KernelEvent): VM {
  switch (e.type) {
    case 'intent_proposed':
      return reduceIntent(vm, e);
    case 'direct_answer':
      return appendLine(rememberTask(vm, e.taskId), `answer: ${e.text}`);
    case 'plan_ready':
      return reducePlan(vm, e);
    case 'step_started':
      return reduceStep(vm, e);
    case 'tool_called':
      return reduceTool(vm, e);
    case 'verdict':
      return appendLine(rememberTask(vm, e.taskId), `verdict: ${e.verdict.acId}/${e.verdict.result}`);
    case 'evidence_produced':
      return reduceEvidence(vm, e);
    case 'gate_request': {
      const pendingGate = { gateId: e.gateId, reason: e.reason };
      return { ...rememberTask(vm, e.taskId), pendingGate, currentActivity: 'waiting:permission' };
    }
    case 'final_result':
      return reduceFinal(vm, e);
    case 'error':
      return appendLine(rememberTask(vm, e.taskId), `error: ${e.message}`);
    default:
      return vm;
  }
}
