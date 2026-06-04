import { describe, expect, it } from 'vitest';
import { TraceStore } from '../src/trace/trace-store';

describe('TraceStore', () => {
  it('appends by task and returns a frozen copy', () => {
    const traceStore = new TraceStore();
    traceStore.append('t1', { type: 'step_started', taskId: 't1', stepId: 'S1' });
    traceStore.append('t1', { type: 'final_result', taskId: 't1', status: 'failed' });

    const trace = traceStore.get('t1');

    expect(trace.map((event) => event.type)).toEqual(['step_started', 'final_result']);
    expect(Object.isFrozen(trace)).toBe(true);
  });
});
