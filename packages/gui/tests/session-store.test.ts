/* eslint-disable max-lines-per-function */
import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '../src/store/session-store';

const initial = useSessionStore.getState();

beforeEach(() => {
  useSessionStore.setState(initial, true);
});

describe('session-store', () => {
  it('addUserMessage 追加用户消息并置状态为 running', () => {
    useSessionStore.getState().addUserMessage('s1', '修一个 bug');
    const state = useSessionStore.getState();

    expect(state.timelines['s1']).toEqual([{ kind: 'user', text: '修一个 bug' }]);
  });

  it('gate_request 事件登记 pendingGate，final_result 清除并记终态', () => {
    const apply = useSessionStore.getState().applyGuiEvent;

    apply({
      kind: 'kernel',
      sessionId: 's1',
      event: { type: 'gate_request', taskId: 't1', gateId: 'g1', reason: '要写文件' }
    });
    expect(useSessionStore.getState().pendingGates['s1']).toEqual({
      gateId: 'g1',
      reason: '要写文件'
    });

    apply({
      kind: 'kernel',
      sessionId: 's1',
      event: { type: 'final_result', taskId: 't1', status: 'done' }
    });

    const state = useSessionStore.getState();
    expect(state.pendingGates['s1']).toBeUndefined();
    expect(state.statuses['s1']).toBe('done');
  });

  it('usage 事件累计用量', () => {
    const apply = useSessionStore.getState().applyGuiEvent;

    apply({
      kind: 'usage',
      sessionId: 's1',
      usage: { inputTokens: 100, outputTokens: 50, cacheHitRate: 0.5, cny: 0.01 }
    });
    apply({
      kind: 'usage',
      sessionId: 's1',
      usage: { inputTokens: 100, outputTokens: 50, cacheHitRate: 0.9, cny: 0.01 }
    });

    expect(useSessionStore.getState().usages['s1']).toEqual({
      inputTokens: 200,
      outputTokens: 100,
      cacheHitRate: 0.9,
      cny: 0.02
    });
  });

  it('kernel 事件进入 timeline，step_started 记录当前步骤', () => {
    const apply = useSessionStore.getState().applyGuiEvent;

    apply({
      kind: 'kernel',
      sessionId: 's1',
      event: { type: 'step_started', taskId: 't1', stepId: 's-3' }
    });

    const state = useSessionStore.getState();
    expect(state.timelines['s1'].length).toBe(1);
    expect(state.currentStepIds['s1']).toBe('s-3');
  });
});
