import type { KernelHost } from '@bobby/kernel';

type HeadlessStatus = 'done' | 'failed' | 'blocked';

// eslint-disable-next-line max-lines-per-function
export async function runHeadless(
  host: KernelHost,
  input: string,
  log: (msg: string) => void = () => {}
): Promise<{ exitCode: number; status: HeadlessStatus }> {
  let status: HeadlessStatus = 'failed';
  let finalStatusEmitted = false;
  let exitCode = 1;

  const emitStatus = (nextStatus: HeadlessStatus): void => {
    status = nextStatus;
    exitCode = nextStatus === 'done' ? 0 : 1;
    finalStatusEmitted = true;
    log(`[status] ${status}`);
  };

  const unsubscribe = host.subscribe((event) => {
    switch (event.type) {
      case 'intent_proposed':
        log(`[plan] goal: ${event.contract.goal}`);
        log(`[plan] acceptanceCriteria: ${event.contract.acceptanceCriteria.length}`);
        break;
      case 'direct_answer':
        log(event.text);
        status = 'done';
        exitCode = 0;
        break;
      case 'plan_ready':
        log(`[plan] steps: ${event.steps.map((step) => step.id).join(', ')}`);
        break;
      case 'step_started':
        log(`[step] started ${event.stepId}`);
        break;
      case 'evidence_produced':
        log(
          `[evidence] type=${event.evidence.evidenceType} claim=${event.evidence.claimId} ac=${event.evidence.acId}`
        );
        break;
      case 'final_result':
        emitStatus(event.status);
        break;
      case 'error':
        log(`[error] ${event.message}`);
        break;
      default:
        break;
    }
  });

  try {
    await host.send({ type: 'startTask', input });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`[error] ${message}`);
    emitStatus('failed');
  } finally {
    if (!finalStatusEmitted) {
      emitStatus(status);
    }
    unsubscribe();
  }

  return {
    exitCode,
    status
  };
}
