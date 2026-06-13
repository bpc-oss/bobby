/* eslint-disable max-lines-per-function */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GuiEvent } from '../src/kernel/client';
import { FIXTURES } from '../src/kernel/mock/fixtures';
import { MockKernelClient } from '../src/kernel/mock/mock-client';

describe('MockKernelClient', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function collect(client: MockKernelClient): GuiEvent[] {
    const events: GuiEvent[] = [];
    client.onEvent((event) => events.push(event));
    return events;
  }

  it('listSessions filters by mode while exposing the richer shell fixture set', async () => {
    const client = new MockKernelClient(FIXTURES);
    const chat = await client.listSessions('chat');
    const code = await client.listSessions('code');

    expect(chat.every((session) => session.mode === 'chat')).toBe(true);
    expect(code.every((session) => session.mode === 'code')).toBe(true);
    expect(chat.map((session) => session.id)).toEqual([
      'chat-basic',
      'chat-pinned-deepseek',
      'chat-project-intro',
      'chat-project-review',
      'chat-today-electron',
      'chat-yesterday-pnpm',
      'chat-yesterday-zustand'
    ]);
    expect(code.map((session) => session.id).sort()).toEqual([
      'code-gate',
      'code-p0-shell',
      'loop-converge',
      'multi-1',
      'paper-release',
      'paper-tools-pdf'
    ]);
  });

  it('gate 暂停: startTask 顺序播放剧本直到 gate_request', async () => {
    const client = new MockKernelClient(FIXTURES);
    const events = collect(client);

    await client.startTask('code-gate', '修一个');
    await vi.advanceTimersByTimeAsync(60_000);

    const kernelTypes = events
      .filter((event): event is Extract<GuiEvent, { kind: 'kernel' }> => event.kind === 'kernel')
      .map((event) => event.event.type);

    expect(kernelTypes).toEqual([
      'plan_ready',
      'step_started',
      'tool_called',
      'step_started',
      'gate_request'
    ]);
  });

  it('gate 恢复: approveGate(allow) 后继续播完 evidence verdict usage final', async () => {
    const client = new MockKernelClient(FIXTURES);
    const events = collect(client);

    await client.startTask('code-gate', '修一个');
    await vi.advanceTimersByTimeAsync(60_000);
    await client.approveGate('code-gate', 'g1', 'allow');
    await vi.advanceTimersByTimeAsync(60_000);

    const types = events.map((event) => (event.kind === 'kernel' ? event.event.type : event.kind));
    expect(types).toContain('evidence_produced');
    expect(types).toContain('verdict');
    expect(types).toContain('usage');
    expect(types[types.length - 1]).toBe('final_result');
  });

  it('gate 拒绝: approveGate(deny) 直接产出 blocked 终态且不再播剩余步骤', async () => {
    const client = new MockKernelClient(FIXTURES);
    const events = collect(client);

    await client.startTask('code-gate', '修一个');
    await vi.advanceTimersByTimeAsync(60_000);
    await client.approveGate('code-gate', 'g1', 'deny');
    await vi.advanceTimersByTimeAsync(60_000);

    const kernelEvents = events.filter(
      (event): event is Extract<GuiEvent, { kind: 'kernel' }> => event.kind === 'kernel'
    );
    const last = kernelEvents[kernelEvents.length - 1];

    expect(last.event).toMatchObject({ type: 'final_result', status: 'blocked' });
    expect(kernelEvents.some((event) => event.event.type === 'evidence_produced')).toBe(false);
  });

  it('createSession returns a new session and exposes it via listSessions', async () => {
    const client = new MockKernelClient(FIXTURES);
    const created = await client.createSession('chat');
    const chat = await client.listSessions('chat');

    expect(chat.some((session) => session.id === created.id)).toBe(true);
  });

  it('promotes a created draft session to the first user prompt title after startTask', async () => {
    const client = new MockKernelClient(FIXTURES);
    const created = await client.createSession('chat');

    await client.startTask(created.id, 'Help me debug this');

    const chat = await client.listSessions('chat');
    const stored = chat.find((session) => session.id === created.id);

    expect(stored).toMatchObject({
      id: created.id,
      title: 'Help me debug this'
    });
  });
});
