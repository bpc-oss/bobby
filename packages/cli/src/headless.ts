import type { KernelEvent } from '@bobby/shared';
import type { KernelHost } from '@bobby/kernel';

type HeadlessStatus = 'done' | 'failed' | 'blocked';

type HeadlessState = {
  status: HeadlessStatus;
  exitCode: number;
  finalStatusEmitted: boolean;
};

const createHeadlessState = (): HeadlessState => ({
  status: 'failed',
  exitCode: 1,
  finalStatusEmitted: false
});

const logStatus = (state: HeadlessState, nextStatus: HeadlessStatus, log: (message: string) => void): void => {
  state.status = nextStatus;
  state.exitCode = nextStatus === 'done' ? 0 : 1;
  state.finalStatusEmitted = true;
  log(`[status] ${state.status}`);
};

const logPlanIntent = (event: Extract<KernelEvent, { type: 'intent_proposed' }>, log: (message: string) => void): void => {
  log(`[plan] goal: ${event.contract.goal}`);
  log(`[plan] acceptanceCriteria: ${event.contract.acceptanceCriteria.length}`);
};

const logPlanSteps = (event: KernelEvent, log: (message: string) => void): void => {
  if (event.type === 'plan_ready') {
    log(`[plan] steps: ${event.steps.map((step) => step.id).join(', ')}`);
  }
};

const logStepStarted = (event: KernelEvent, log: (message: string) => void): void => {
  if (event.type === 'step_started') {
    log(`[step] started ${event.stepId}`);
  }
};

const logEvidence = (event: KernelEvent, log: (message: string) => void): void => {
  if (event.type === 'evidence_produced') {
    log(
      `[evidence] type=${event.evidence.evidenceType} claim=${event.evidence.claimId} ac=${event.evidence.acId}`
    );
  }
};

const logError = (event: KernelEvent, log: (message: string) => void): void => {
  if (event.type === 'error') {
    log(`[error] ${event.message}`);
  }
};

const logAssistantDelta = (event: Extract<KernelEvent, { type: 'assistant_delta' }>, log: (message: string) => void): void => {
  log(event.content);
};

const logReasoningDelta = (
  event: Extract<KernelEvent, { type: 'reasoning_delta' }>,
  log: (message: string) => void
): void => {
  log(`[reasoning] ${event.content}`);
};

const formatToolDeltaLine = (event: Extract<KernelEvent, { type: 'tool_delta' }>): string => {
  const parts = ['[tool]', event.status];
  if (event.tool) {
    parts.push(event.tool);
  }
  if (event.content) {
    parts.push(event.content);
  }
  return parts.join(' ');
};

const logToolDelta = (event: Extract<KernelEvent, { type: 'tool_delta' }>, log: (message: string) => void): void => {
  log(formatToolDeltaLine(event));
};

const logUsageDelta = (event: Extract<KernelEvent, { type: 'usage_delta' }>, log: (message: string) => void): void => {
  const parts: string[] = [];
  if (event.model) {
    parts.push(`model=${event.model}`);
  }
  if (typeof event.promptTokens === 'number') {
    parts.push(`prompt=${event.promptTokens}`);
  }
  if (typeof event.completionTokens === 'number') {
    parts.push(`completion=${event.completionTokens}`);
  }
  if (typeof event.cachedTokens === 'number') {
    parts.push(`cached=${event.cachedTokens}`);
  }
  if (typeof event.costUsd === 'number') {
    parts.push(`cost=$${event.costUsd.toFixed(4)}`);
  }

  log(`[usage] ${parts.join(' ')}`);
};

const dispatchPlanDecision = async (
  host: KernelHost,
  event: Extract<KernelEvent, { type: 'plan_ready' }>
): Promise<void> => {
  await host.send({ type: 'planDecision', taskId: event.taskId, decision: 'approve' });
};

const processHeadlessEvent = (
  host: KernelHost,
  state: HeadlessState,
  log: (message: string) => void,
  event: KernelEvent
): void => {
  if (event.type === 'intent_proposed') {
    logPlanIntent(event, log);
    return;
  }
  if (event.type === 'direct_answer') {
    log(event.text);
    logStatus(state, 'done', log);
    return;
  }
  if (event.type === 'plan_ready') {
    logPlanSteps(event, log);
    void dispatchPlanDecision(host, event);
    return;
  }
  if (event.type === 'step_started') {
    logStepStarted(event, log);
    return;
  }
  if (event.type === 'evidence_produced') {
    logEvidence(event, log);
    return;
  }
  if (event.type === 'final_result') {
    logStatus(state, event.status, log);
    return;
  }
  if (event.type === 'assistant_delta') {
    logAssistantDelta(event, log);
    return;
  }
  if (event.type === 'reasoning_delta') {
    logReasoningDelta(event, log);
    return;
  }
  if (event.type === 'tool_delta') {
    logToolDelta(event, log);
    return;
  }
  if (event.type === 'usage_delta') {
    logUsageDelta(event, log);
    return;
  }
  logError(event, log);
};

const createEventHandler = (host: KernelHost, state: HeadlessState, log: (message: string) => void) => {
  return (event: KernelEvent): void => {
    processHeadlessEvent(host, state, log, event);
  };
};

const ensureFinalStatus = (state: HeadlessState, log: (message: string) => void): void => {
  if (!state.finalStatusEmitted) {
    logStatus(state, state.status, log);
  }
};

export async function runHeadless(
  host: KernelHost,
  input: string,
  log: (msg: string) => void = () => {}
): Promise<{ exitCode: number; status: HeadlessStatus }> {
  const state = createHeadlessState();
  const unsubscribe = host.subscribe(createEventHandler(host, state, log));

  try {
    await host.send({ type: 'startTask', input });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`[error] ${message}`);
    logStatus(state, 'failed', log);
  } finally {
    ensureFinalStatus(state, log);
    unsubscribe();
  }

  return {
    exitCode: state.exitCode,
    status: state.status
  };
}
