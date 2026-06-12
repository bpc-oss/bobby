import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setKernelClient } from '../src/kernel';
import type { KernelClient } from '../src/kernel/client';
import { useSessionStore } from '../src/store/session-store';
import { SessionView } from '../src/workspace/SessionView';

const initialSession = useSessionStore.getState();

function stubClient(overrides: Partial<KernelClient> = {}): KernelClient {
  return {
    listSessions: vi.fn(async () => []),
    createSession: vi.fn(async () => ({
      id: 'x',
      mode: 'chat' as const,
      title: 'New Chat',
      pinned: false,
      status: 'idle' as const,
      updatedAt: ''
    })),
    startTask: vi.fn(async () => undefined),
    approveGate: vi.fn(async () => undefined),
    onEvent: vi.fn(() => () => undefined),
    ...overrides
  };
}

beforeEach(() => {
  useSessionStore.setState(initialSession, true);
  setKernelClient(null);
});

afterEach(() => {
  cleanup();
});

describe('SessionView（live）', () => {
  it('发送输入：先进 timeline 再调 client.startTask', () => {
    const client = stubClient();
    setKernelClient(client);
    useSessionStore.getState().setSessions([
      {
        id: 's1',
        mode: 'code',
        title: '修复 updater',
        branch: 'fix/u',
        pinned: false,
        status: 'idle',
        updatedAt: ''
      }
    ]);
    render(<SessionView sessionId="s1" />);
    fireEvent.change(screen.getByPlaceholderText(/询问或下达任务/), {
      target: { value: '开始吧' }
    });
    fireEvent.click(screen.getByText(/发送/));
    expect(useSessionStore.getState().timelines['s1'][0]).toEqual({
      kind: 'user',
      text: '开始吧'
    });
    expect(client.startTask).toHaveBeenCalledWith('s1', '开始吧');
  });

  it('pendingGate 时点击允许调用 client.approveGate', () => {
    const client = stubClient();
    setKernelClient(client);
    useSessionStore.getState().setSessions([
      { id: 's1', mode: 'code', title: 't', pinned: false, status: 'gate', updatedAt: '' }
    ]);
    useSessionStore.getState().applyGuiEvent({
      kind: 'kernel',
      sessionId: 's1',
      event: { type: 'gate_request', taskId: 't1', gateId: 'g9', reason: '要执行命令' }
    });
    render(<SessionView sessionId="s1" />);
    fireEvent.click(screen.getByText('允许'));
    expect(client.approveGate).toHaveBeenCalledWith('s1', 'g9', 'allow');
  });

  it('usage 显示在 UsageBar', () => {
    setKernelClient(stubClient());
    useSessionStore.getState().setSessions([
      { id: 's1', mode: 'chat', title: 't', pinned: false, status: 'idle', updatedAt: '' }
    ]);
    useSessionStore.getState().applyGuiEvent({
      kind: 'usage',
      sessionId: 's1',
      usage: { inputTokens: 8100, outputTokens: 4200, cacheHitRate: 0.92, cny: 0.18 }
    });
    render(<SessionView sessionId="s1" />);
    expect(screen.getByText(/92%/)).toBeTruthy();
  });
});
