import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore, type ChatBlock } from '../src/store/chat-store';
import type { SessionRecordDto } from '../src/ipc/contract';
import type { KernelEvent } from '@bobby/shared';

function userBlock(id: string, text: string): ChatBlock {
  return { kind: 'user', id, text };
}

function session(id: string, title: string, blocks: ChatBlock[]): SessionRecordDto {
  return {
    id,
    title,
    blocks,
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
    projectDir: 'E:\\ai-files\\Bobby',
    taskId: null,
    status: 'done',
    liveReasoning: '',
    liveAssistant: '',
    liveToolContent: '',
    currentPlan: [],
    error: null,
    costUsd: 0,
    spendUsd: 0,
    model: null,
    mode: 'standard'
  };
}

beforeEach(() => {
  (window as unknown as { bobby?: { saveSession: ReturnType<typeof vi.fn> } }).bobby = {
    saveSession: vi.fn().mockResolvedValue(undefined)
  };
  useChatStore.setState({
    blocks: [],
    liveReasoning: '',
    liveAssistant: '',
    liveToolContent: '',
    busy: false,
    currentTaskId: null,
    currentPlan: [],
    status: 'idle',
    error: null,
    costUsd: 0,
    spendUsd: 0,
    model: null,
    threads: {},
    taskThreadIds: {},
    pendingThreadIds: [],
    sessions: [],
    activeSessionId: null,
    currentProject: null,
    recentProjects: []
  });
});

afterEach(() => {
  delete (window as unknown as { bobby?: unknown }).bobby;
  vi.restoreAllMocks();
});

describe('chat session store', () => {
  it('does not duplicate the active session when it is selected again', () => {
    const existing = session('s1', 'Run this through Mission Control', [userBlock('u1', 'Run this through Mission Control')]);
    useChatStore.setState({
      sessions: [existing],
      activeSessionId: 's1',
      blocks: [userBlock('u1', 'Run this through Mission Control')],
      status: 'done'
    });

    useChatStore.getState().switchSession('s1');

    const state = useChatStore.getState();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].id).toBe('s1');
    expect(state.activeSessionId).toBe('s1');
    expect(state.blocks).toEqual(existing.blocks);
  });

  it('snapshots the current session and loads the requested session without creating same-title copies', () => {
    const current = session('current', 'Current task', [userBlock('u-current', 'Current task')]);
    const target = session('target', 'Run this through Mission Control', [userBlock('u-target', 'Run this through Mission Control')]);
    useChatStore.setState({
      sessions: [target, current],
      activeSessionId: 'current',
      blocks: current.blocks as ChatBlock[],
      status: 'running'
    });

    useChatStore.getState().switchSession('target');

    const state = useChatStore.getState();
    expect(state.sessions.map((item) => item.id).sort()).toEqual(['current', 'target']);
    expect(state.sessions.filter((item) => item.title === 'Run this through Mission Control')).toHaveLength(1);
    expect(state.activeSessionId).toBe('target');
    expect(state.blocks).toEqual(target.blocks);
  });

  it('does not snapshot the visible target session when activeSessionId is missing', () => {
    const target = session('target', 'Run this through Mission Control', [userBlock('u-target', 'Run this through Mission Control')]);
    useChatStore.setState({
      sessions: [target],
      activeSessionId: null,
      blocks: target.blocks as ChatBlock[],
      status: 'done'
    });

    useChatStore.getState().switchSession('target');

    const state = useChatStore.getState();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].id).toBe('target');
    expect(state.sessions.filter((item) => item.title === 'Run this through Mission Control')).toHaveLength(1);
    expect(state.activeSessionId).toBe('target');
  });

  it('does not create a same-title snapshot when selecting a persisted session', () => {
    const target = session('target', 'Run this through Mission Control', [userBlock('persisted-user', 'Run this through Mission Control')]);
    useChatStore.setState({
      sessions: [target],
      activeSessionId: null,
      blocks: [userBlock('visible-user-with-different-id', 'Run this through Mission Control')],
      status: 'done'
    });

    useChatStore.getState().switchSession('target');

    const state = useChatStore.getState();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions.filter((item) => item.title === 'Run this through Mission Control')).toHaveLength(1);
    expect(state.activeSessionId).toBe('target');
    expect(state.blocks).toEqual(target.blocks);
  });

  it('deduplicates persisted same-title sessions when loading sessions', async () => {
    const newest = { ...session('newest', 'Same task', [userBlock('u-new', 'Same task')]), updatedAt: '2026-06-11T01:00:00.000Z' };
    const duplicate = { ...session('duplicate', 'Same task', [userBlock('u-old', 'Same task')]), updatedAt: '2026-06-11T00:30:00.000Z' };
    (window as unknown as { bobby: { listSessions: ReturnType<typeof vi.fn> } }).bobby.listSessions = vi.fn().mockResolvedValue([duplicate, newest]);

    await useChatStore.getState().loadSessions();

    const state = useChatStore.getState();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].id).toBe('newest');
    expect(state.sessions[0].title).toBe('Same task');
  });

  it('hydrates thread maps from persisted sessions so resume works after restart', async () => {
    const restored = session('restored', 'Restored task', [userBlock('u-restored', 'Restored task')]);
    restored.taskId = 'task-restored';
    (window as unknown as { bobby: { listSessions: ReturnType<typeof vi.fn> } }).bobby.listSessions = vi.fn().mockResolvedValue([restored]);

    await useChatStore.getState().loadSessions();
    useChatStore.getState().switchSession('restored');

    const state = useChatStore.getState();
    expect(state.threads.restored?.taskId).toBe('task-restored');
    expect(state.taskThreadIds['task-restored']).toBe('restored');
    expect(state.blocks).toEqual(restored.blocks);
  });

  it('restores the last active session from localStorage after sessions load', async () => {
    const restored = session('restored', 'Restored task', [userBlock('u-restored', 'Restored task')]);
    restored.taskId = 'task-restored';
    localStorage.setItem('bobby-last-active-session', 'restored');
    (window as unknown as { bobby: { listSessions: ReturnType<typeof vi.fn> } }).bobby.listSessions = vi.fn().mockResolvedValue([restored]);

    await useChatStore.getState().loadSessions();

    const state = useChatStore.getState();
    expect(state.activeSessionId).toBe('restored');
    expect(state.blocks).toEqual(restored.blocks);
  });

  it('routes background task events into their own session without polluting the visible session', () => {
    const first = session('first', 'First task', [userBlock('u-first', 'First task')]);
    first.taskId = 'task-first';
    first.status = 'running';
    const second = session('second', 'Second task', [userBlock('u-second', 'Second task')]);
    second.taskId = 'task-second';
    second.status = 'running';

    useChatStore.setState({
      sessions: [first],
      activeSessionId: 'second',
      blocks: second.blocks as ChatBlock[],
      currentTaskId: 'task-second',
      status: 'running',
      busy: true
    });

    const event: KernelEvent = {
      type: 'tool_called',
      taskId: 'task-first',
      stepId: 'S1',
      tool: 'exec pnpm test'
    };

    useChatStore.getState().handleEvent(event);

    const state = useChatStore.getState();
    expect(state.blocks).toEqual(second.blocks);
    const updatedFirst = state.sessions.find((item) => item.id === 'first');
    expect(updatedFirst?.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'tool', tool: 'exec pnpm test' })
    ]));
  });

  it('keeps two parallel task threads isolated by taskId', async () => {
    const startTask = vi.fn().mockResolvedValue(undefined);
    useChatStore.setState({ _client: { startTask } });

    await useChatStore.getState().sendMessage('Task one');
    const firstThreadId = useChatStore.getState().activeSessionId;
    if (!firstThreadId) throw new Error('first thread missing');

    useChatStore.getState().handleEvent({
      type: 'intent_proposed',
      taskId: 'task-one',
      contract: { goal: 'Task one', acceptanceCriteria: [], constraints: [], inputs: [], outOfScope: [] }
    });

    await useChatStore.getState().sendMessage('Task two');
    const secondThreadId = useChatStore.getState().activeSessionId;
    if (!secondThreadId) throw new Error('second thread missing');

    useChatStore.getState().handleEvent({
      type: 'intent_proposed',
      taskId: 'task-two',
      contract: { goal: 'Task two', acceptanceCriteria: [], constraints: [], inputs: [], outOfScope: [] }
    });
    useChatStore.getState().handleEvent({ type: 'assistant_delta', taskId: 'task-one', content: 'First thread', sequence: 0 });
    useChatStore.getState().handleEvent({ type: 'final_result', taskId: 'task-one', status: 'failed' });
    useChatStore.getState().handleEvent({ type: 'assistant_delta', taskId: 'task-two', content: 'Second thread', sequence: 0 });
    useChatStore.getState().handleEvent({ type: 'final_result', taskId: 'task-two', status: 'done' });

    const state = useChatStore.getState();
    expect(startTask).toHaveBeenCalledTimes(2);
    expect(state.threads[firstThreadId]?.taskId).toBe('task-one');
    expect(state.threads[firstThreadId]?.status).toBe('failed');
    expect(state.threads[secondThreadId]?.taskId).toBe('task-two');
    expect(state.threads[secondThreadId]?.status).toBe('done');
    expect(state.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'user', text: 'Task two' })
    ]));
    expect(state.blocks).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'assistant', text: 'First thread' })
    ]));
  });

  it('snapshots a running task before starting another active task', async () => {
    const startTask = vi.fn().mockResolvedValue(undefined);
    useChatStore.setState({
      blocks: [userBlock('u-current', 'Long running task')],
      activeSessionId: 'current',
      currentTaskId: 'task-current',
      status: 'running',
      busy: true,
      _client: { startTask }
    });

    await useChatStore.getState().sendMessage('Second task');

    const state = useChatStore.getState();
    expect(startTask).toHaveBeenCalledWith('Second task', 'standard');
    expect(state.blocks).toEqual([expect.objectContaining({ kind: 'user', text: 'Second task' })]);
    expect(state.sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskId: 'task-current', status: 'running' })
    ]));
  });

  it('keeps the first task on one stable session id while kernel events stream in', async () => {
    const startTask = vi.fn().mockResolvedValue(undefined);
    useChatStore.setState({ _client: { startTask } });

    await useChatStore.getState().sendMessage('Run this through Mission Control');
    const activeSessionId = useChatStore.getState().activeSessionId;

    useChatStore.getState().handleEvent({
      type: 'intent_proposed',
      taskId: 'task-1',
      contract: { goal: 'Run this through Mission Control', acceptanceCriteria: [], constraints: [], inputs: [], outOfScope: [] }
    });
    useChatStore.getState().handleEvent({ type: 'assistant_delta', taskId: 'task-1', content: 'Working', sequence: 0 });
    useChatStore.getState().handleEvent({ type: 'final_result', taskId: 'task-1', status: 'done' });

    const saveSession = (window as unknown as { bobby: { saveSession: ReturnType<typeof vi.fn> } }).bobby.saveSession;
    const savedIds = saveSession.mock.calls.map(([saved]) => saved.id);

    expect(activeSessionId).toBeTruthy();
    expect(new Set(savedIds)).toEqual(new Set([activeSessionId]));
  });

  it('restores the session-specific mode when switching between sessions', () => {
    const standard = session('standard', 'Standard task', [userBlock('u-standard', 'Standard task')]);
    const locked = session('locked', 'Locked task', [userBlock('u-locked', 'Locked task')]);
    locked.mode = 'plan-only';
    useChatStore.setState({
      sessions: [standard, locked],
      threads: {
        standard,
        locked
      },
      activeSessionId: 'standard',
      blocks: standard.blocks as ChatBlock[],
      sessionMode: 'standard'
    });

    useChatStore.getState().setSessionMode('full');
    expect(useChatStore.getState().sessionMode).toBe('full');
    expect(useChatStore.getState().threads.standard?.mode).toBe('full');

    useChatStore.getState().switchSession('locked');
    expect(useChatStore.getState().sessionMode).toBe('plan-only');
    expect(useChatStore.getState().blocks).toEqual(locked.blocks);

    useChatStore.getState().switchSession('standard');
    expect(useChatStore.getState().sessionMode).toBe('full');
  });
});
