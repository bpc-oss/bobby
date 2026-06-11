import { create } from 'zustand';
import type { Evidence, KernelEvent, PlanStep } from '@bobby/shared';
import {
  ProjectListSchema,
  ProjectMetaSchema,
  SessionRecordSchema,
  type SessionMode,
  type ProjectMeta,
  type SessionRecordDto
} from '../ipc/contract';

// ---- Chat block types ----

export type UserBlock = {
  kind: 'user';
  id: string;
  text: string;
};

export type AssistantBlock = {
  kind: 'assistant';
  id: string;
  text: string;
};

export type ReasoningBlock = {
  kind: 'reasoning';
  id: string;
  text: string;
};

export type ToolBlock = {
  kind: 'tool';
  id: string;
  tool: string;
  status: 'start' | 'running' | 'done';
  content: string;
};

export type EvidenceBlock = {
  kind: 'evidence';
  id: string;
  evidence: Evidence;
};

export type VerdictBlock = {
  kind: 'verdict';
  id: string;
  acId: string;
  result: string;
};

export type PlanBlock = {
  kind: 'plan';
  id: string;
  steps: PlanStep[];
  status: 'pending' | 'approved' | 'rejected';
};

export type StatusBlock = {
  kind: 'status';
  id: string;
  status: 'done' | 'failed' | 'blocked';
};

export type GateBlock = {
  kind: 'gate';
  id: string;
  gateId: string;
  reason: string;
};

export type ErrorBlock = {
  kind: 'error';
  id: string;
  message: string;
};

export type ChatBlock =
  | UserBlock
  | AssistantBlock
  | ReasoningBlock
  | ToolBlock
  | EvidenceBlock
  | VerdictBlock
  | PlanBlock
  | StatusBlock
  | GateBlock
  | ErrorBlock;

// ---- Store types ----

export type ChatState = {
  blocks: ChatBlock[];
  liveReasoning: string;
  liveAssistant: string;
  liveToolContent: string;
  busy: boolean;
  currentTaskId: string | null;
  currentPlan: PlanStep[];
  status: 'idle' | 'running' | 'done' | 'failed' | 'blocked';
  error: string | null;
  costUsd: number;
  spendUsd: number;
  model: string | null;
  sessionMode: SessionMode;
  threads: Record<string, ThreadRecord>;
  taskThreadIds: Record<string, string>;
  pendingThreadIds: string[];
  sessions: SessionRecordDto[];
  activeSessionId: string | null;
  currentProject: ProjectMeta | null;
  recentProjects: ProjectMeta[];

  // Internal client  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _client: any;
  setClient: (client: any) => void;

  // Actions
  sendMessage: (text: string) => Promise<void>;
  handleEvent: (event: KernelEvent) => void;
  approveGate: (gateId: string, decision: 'allow' | 'always' | 'deny') => Promise<void>;
  approvePlan: (taskId: string, decision: 'approve' | 'reject' | 'edit', instructions?: string) => Promise<void>;
  abort: () => Promise<void>;
  clearBlocks: () => void;
  newSession: () => void;
  switchSession: (id: string) => void;
  resumeSession: (id: string) => void;
  setSessionMode: (mode: SessionMode) => void;
  loadProjectState: () => Promise<void>;
  openProject: () => Promise<void>;
  selectProject: (projectDir: string) => Promise<void>;
  loadSessions: () => Promise<void>;
};

type ThreadRecord = SessionRecordDto;

// ---- Helpers ----

let nextId = 1;
const uid = (): string => `b${nextId++}`;

function nowIso(): string {
  return new Date().toISOString();
}

function sessionTitle(blocks: ChatBlock[]): string {
  return blocks.find((b) => b.kind === 'user')?.text?.slice(0, 80) || 'New session';
}

function makeBlankSession(id: string, projectDir: string | null, createdAt = nowIso()): SessionRecordDto {
  return SessionRecordSchema.parse({
    id,
    title: 'New session',
    blocks: [],
    createdAt,
    updatedAt: createdAt,
    projectDir,
    taskId: null,
    status: 'idle',
    liveReasoning: '',
    liveAssistant: '',
    liveToolContent: '',
    currentPlan: [],
    error: null,
    costUsd: 0,
    spendUsd: 0,
    model: null,
    mode: 'standard'
  });
}

function cloneSessionForResume(source: SessionRecordDto, id = uid()): SessionRecordDto {
  return SessionRecordSchema.parse({
    ...source,
    id,
    title: source.title,
    blocks: [...(source.blocks as ChatBlock[])],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    taskId: null,
    status: 'idle',
    liveReasoning: '',
    liveAssistant: '',
    liveToolContent: '',
    error: null,
    costUsd: 0,
    spendUsd: 0,
    model: null
  });
}

function snapshotSession(state: ChatState, id = state.activeSessionId ?? uid()): SessionRecordDto {
  const current = state.threads[id] ?? state.sessions.find((session) => session.id === id);
  const createdAt = current?.createdAt ?? nowIso();
  return SessionRecordSchema.parse({
    id,
    title: sessionTitle(state.blocks),
    blocks: state.blocks,
    createdAt,
    updatedAt: nowIso(),
    projectDir: state.currentProject?.path ?? null,
    taskId: state.currentTaskId,
    status: state.status,
    liveReasoning: state.liveReasoning,
    liveAssistant: state.liveAssistant,
    liveToolContent: state.liveToolContent,
    currentPlan: state.currentPlan,
    error: state.error,
    costUsd: state.costUsd,
    spendUsd: state.spendUsd,
    model: state.model,
    mode: state.sessionMode
  });
}

function replaceSession(sessions: SessionRecordDto[], next: SessionRecordDto): SessionRecordDto[] {
  const filtered = sessions.filter((session) => session.id !== next.id);
  return [next, ...filtered].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function replaceThread(threads: Record<string, ThreadRecord>, next: ThreadRecord): Record<string, ThreadRecord> {
  return { ...threads, [next.id]: next };
}

function threadOrder(threads: Record<string, ThreadRecord>): ThreadRecord[] {
  return Object.values(threads).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function dedupeSessions(sessions: SessionRecordDto[]): SessionRecordDto[] {
  const byTitle = new Map<string, SessionRecordDto>();
  for (const session of sessions) {
    const existing = byTitle.get(session.title);
    if (!existing || new Date(session.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      byTitle.set(session.title, session);
    }
  }
  return Array.from(byTitle.values()).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function resetThreadState(session?: SessionRecordDto) {
  return {
    blocks: session ? [...(session.blocks as ChatBlock[])] : [],
    liveReasoning: session?.liveReasoning ?? '',
    liveAssistant: session?.liveAssistant ?? '',
    liveToolContent: session?.liveToolContent ?? '',
    busy: session?.status === 'running',
    currentTaskId: session?.taskId ?? null,
    currentPlan: session?.currentPlan ?? [],
    status: session?.status ?? 'idle',
    error: session?.error ?? null,
    costUsd: session?.costUsd ?? 0,
    spendUsd: session?.spendUsd ?? 0,
    model: session?.model ?? null,
    sessionMode: session?.mode ?? 'standard',
    activeSessionId: session?.id ?? null
  };
}

function currentThreadSnapshot(state: ChatState, id = state.activeSessionId ?? uid()): SessionRecordDto {
  const existing = state.threads[id] ?? state.sessions.find((session) => session.id === id);
  const createdAt = existing?.createdAt ?? nowIso();
  return SessionRecordSchema.parse({
    id,
    title: sessionTitle(state.blocks),
    blocks: state.blocks,
    createdAt,
    updatedAt: nowIso(),
    projectDir: state.currentProject?.path ?? existing?.projectDir ?? null,
    taskId: state.currentTaskId,
    status: state.status,
    liveReasoning: state.liveReasoning,
    liveAssistant: state.liveAssistant,
    liveToolContent: state.liveToolContent,
    currentPlan: state.currentPlan,
    error: state.error,
    costUsd: state.costUsd,
    spendUsd: state.spendUsd,
    model: state.model,
    mode: state.sessionMode
  });
}

function updateCurrentThreadState(state: ChatState, thread: SessionRecordDto): Partial<ChatState> {
  return {
    blocks: [...(thread.blocks as ChatBlock[])],
    liveReasoning: thread.liveReasoning,
    liveAssistant: thread.liveAssistant,
    liveToolContent: thread.liveToolContent,
    busy: thread.status === 'running',
    currentTaskId: thread.taskId,
    currentPlan: thread.currentPlan,
    status: thread.status,
    error: thread.error,
    costUsd: thread.costUsd,
    spendUsd: thread.spendUsd,
    model: thread.model,
    sessionMode: thread.mode ?? 'standard',
    activeSessionId: thread.id,
    threads: replaceThread(state.threads, thread)
  };
}

function sameBlocks(left: ChatBlock[], right: unknown[]): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function resetLiveState(session?: SessionRecordDto) {
  return {
    blocks: session ? [...(session.blocks as ChatBlock[])] : [],
    liveReasoning: session?.liveReasoning ?? '',
    liveAssistant: session?.liveAssistant ?? '',
    liveToolContent: session?.liveToolContent ?? '',
    busy: session?.status === 'running',
    currentTaskId: session?.taskId ?? null,
    currentPlan: session?.currentPlan ?? [],
    status: session?.status ?? 'idle',
    error: session?.error ?? null,
    costUsd: session?.costUsd ?? 0,
    spendUsd: session?.spendUsd ?? 0,
    model: session?.model ?? null,
    sessionMode: session?.mode ?? 'standard',
    activeSessionId: session?.id ?? null
  };
}

function stateFromThread(base: ChatState, thread: ThreadRecord): ChatState {
  return {
    ...base,
    ...resetLiveState(thread),
    sessions: replaceSession(base.sessions, thread),
    threads: replaceThread(base.threads, thread),
    taskThreadIds: thread.taskId ? { ...base.taskThreadIds, [thread.taskId]: thread.id } : base.taskThreadIds,
    pendingThreadIds: base.pendingThreadIds.filter((threadId) => threadId !== thread.id),
    currentProject: base.currentProject,
    recentProjects: base.recentProjects,
    _client: base._client
  };
}

function threadSummary(state: ChatState): ThreadRecord[] {
  return threadOrder(state.threads);
}

function activeThreadFromState(state: ChatState): ThreadRecord | null {
  if (state.activeSessionId && state.threads[state.activeSessionId]) {
    return state.threads[state.activeSessionId];
  }
  if (state.activeSessionId) {
    const session = state.sessions.find((item) => item.id === state.activeSessionId);
    if (session) {
      return session;
    }
  }
  if (state.blocks.length > 0 || state.currentTaskId || state.liveAssistant || state.liveReasoning || state.liveToolContent) {
    return currentThreadSnapshot(state);
  }
  return null;
}

function upsertThread(state: ChatState, thread: ThreadRecord, options: { active?: boolean; updateSession?: boolean } = {}): Partial<ChatState> {
  const nextThreads = replaceThread(state.threads, thread);
  const nextSessions = options.updateSession === false ? state.sessions : replaceSession(state.sessions, thread);
  return {
    threads: nextThreads,
    sessions: nextSessions,
    ...(options.active ? updateCurrentThreadState(state, thread) : {})
  };
}

function startPendingThread(state: ChatState, threadId: string): Partial<ChatState> {
  return {
    activeSessionId: threadId,
    pendingThreadIds: [...state.pendingThreadIds, threadId]
  };
}

function resolveThreadId(state: ChatState, taskId: string): string | null {
  const mapped = state.taskThreadIds[taskId];
  if (mapped) return mapped;
  const pending = state.pendingThreadIds.find((threadId) => !state.threads[threadId]?.taskId);
  if (pending) return pending;
  const existing = threadSummary(state).find((thread) => thread.taskId === taskId);
  if (existing) return existing.id;
  const historical = state.sessions.find((session) => session.taskId === taskId);
  if (historical) return historical.id;
  return null;
}

async function persistSession(session: SessionRecordDto): Promise<void> {
  try {
    await window.bobby?.saveSession?.(session);
  } catch {
    // Persistence is best-effort; renderer state remains authoritative for the current turn.
  }
}

function readLastActiveSessionId(): string | null {
  try {
    return localStorage.getItem('bobby-last-active-session');
  } catch {
    return null;
  }
}

// ---- Event sink ----

export function reduceEvent(state: ChatState, event: KernelEvent): Partial<ChatState> {
  const partial: Partial<ChatState> = {};

  switch (event.type) {
    case 'intent_proposed': {
      partial.currentTaskId = event.taskId;
      partial.status = 'running';
      partial.busy = true;
      break;
    }
    case 'direct_answer': {
      partial.blocks = [...state.blocks, { kind: 'assistant', id: uid(), text: event.text }];
      break;
    }
    case 'plan_ready': {
      partial.currentPlan = event.steps;
      partial.blocks = [
        ...state.blocks,
        { kind: 'plan', id: uid(), steps: event.steps, status: 'pending' }
      ];
      break;
    }
    case 'step_started': {
      break;
    }
    case 'tool_called': {
      partial.blocks = [
        ...state.blocks,
        { kind: 'tool', id: uid(), tool: event.tool, status: 'start', content: '' }
      ];
      break;
    }
    case 'tool_delta': {
      const deltaContent = [event.status, event.tool, event.content].filter(Boolean).join(' ');
      const lastTool = [...state.blocks].reverse().find((b) => b.kind === 'tool');
      if (lastTool && lastTool.kind === 'tool') {
        const prevContent = (lastTool as ToolBlock).content;
        partial.blocks = state.blocks.map((b) =>
          b.id === lastTool.id && b.kind === 'tool'
            ? { ...b, content: prevContent ? `${prevContent} ${deltaContent}` : deltaContent, status: 'running' as const }
            : b
        );
      }
      partial.liveToolContent = state.liveToolContent ? `${state.liveToolContent} ${deltaContent}` : deltaContent;
      break;
    }
    case 'evidence_produced': {
      partial.blocks = [...state.blocks, { kind: 'evidence', id: uid(), evidence: event.evidence }];
      break;
    }
    case 'verdict': {
      if (event.verdict.result !== 'pass') {
        partial.blocks = [
          ...state.blocks,
          { kind: 'verdict', id: uid(), acId: event.verdict.acId, result: event.verdict.result }
        ];
      }
      break;
    }
    case 'assistant_delta': {
      partial.liveAssistant = `${state.liveAssistant}${event.content}`;
      break;
    }
    case 'reasoning_delta': {
      partial.liveReasoning = `${state.liveReasoning}${event.content}`;
      break;
    }
    case 'usage_delta': {
      if (event.model) partial.model = event.model;
      if (event.costUsd) partial.costUsd = event.costUsd;
      break;
    }
    case 'gate_request': {
      partial.blocks = [...state.blocks, { kind: 'gate', id: uid(), gateId: event.gateId, reason: event.reason }];
      break;
    }
    case 'final_result': {
      // Flush live blocks
      const newBlocks: ChatBlock[] = [];
      if (state.liveReasoning) {
        newBlocks.push({ kind: 'reasoning', id: uid(), text: state.liveReasoning });
      }
      if (state.liveAssistant) {
        newBlocks.push({ kind: 'assistant', id: uid(), text: state.liveAssistant });
      }
      newBlocks.push({ kind: 'status', id: uid(), status: event.status });

      partial.blocks = [...state.blocks, ...newBlocks];
      partial.liveReasoning = '';
      partial.liveAssistant = '';
      partial.liveToolContent = '';
      partial.busy = false;
      partial.status = event.status;
      break;
    }
    case 'error': {
      partial.blocks = [...state.blocks, { kind: 'error', id: uid(), message: event.message }];
      partial.error = event.message;
      partial.busy = false;
      partial.status = 'failed';
      break;
    }
  }

  return partial;
}

// ---- Mock mode (no backend) ----

function mockReply(text: string) {
  const event = (e: KernelEvent) => useChatStore.getState().handleEvent(e);
  const taskId = 'mock-' + Date.now();
  const isGreeting = /hello|hi|hey|你好|帮助|help/i.test(text);

  if (isGreeting) {
    event({ type: 'intent_proposed', taskId, contract: { goal: 'Respond to greeting', acceptanceCriteria: [], constraints: [], inputs: [], outOfScope: [] } });
    event({ type: 'assistant_delta', taskId, content: "Hello! I'm Bobby, your local coding agent. I can help with:\n\n", sequence: 0 });
    event({ type: 'assistant_delta', taskId, content: "- 📝 Creating and editing files\n", sequence: 1 });
    event({ type: 'assistant_delta', taskId, content: "- ⚡ Running commands\n", sequence: 2 });
    event({ type: 'assistant_delta', taskId, content: "- 🔍 Reviewing code\n", sequence: 3 });
    event({ type: 'assistant_delta', taskId, content: "- 💡 Explaining code\n\n", sequence: 4 });
    event({ type: 'assistant_delta', taskId, content: "This is a **demo mode** - no backend connected. Run the full Electron app to connect to DeepSeek.", sequence: 5 });
    event({ type: 'final_result', taskId, status: 'done' });
    return;
  }

  event({ type: 'intent_proposed', taskId, contract: { goal: text, acceptanceCriteria: [], constraints: [], inputs: [], outOfScope: [] } });
  event({ type: 'plan_ready', taskId, steps: [{ id: 'S1', desc: 'Analyze and execute', satisfiesAcIds: ['AC1'], dependsOn: [] }] });
  event({ type: 'step_started', taskId, stepId: 'S1' });

  event({ type: 'reasoning_delta', taskId, content: 'Let me analyze: ' + text.slice(0, 80) + '\n', sequence: 0 });
  event({ type: 'reasoning_delta', taskId, content: 'Executing step by step.\n', sequence: 1 });
  event({ type: 'reasoning_delta', taskId, content: '[Demo mode]', sequence: 2 });

  event({ type: 'tool_called', taskId, stepId: 'S1', tool: 'write_file notes.txt' });
  event({ type: 'tool_delta', taskId, status: 'start', tool: 'write_file', content: 'notes.txt', sequence: 0 });
  event({ type: 'tool_delta', taskId, status: 'end', tool: 'write_file', content: 'notes.txt', sequence: 1 });
  event({ type: 'evidence_produced', taskId, evidence: { claimId: 'C1', acId: 'AC1', evidenceType: 'file_diff', payload: { path: 'notes.txt', bytes: 42, patch: '@@ -0,0 +1,3 @@\n+# Bobby Notes\n+\n+This is a demo file created by Bobby.\n+Run the full Electron app for real file operations.' }, producedBy: 'tool' } });
  event({ type: 'verdict', taskId, verdict: { claimId: 'C1', acId: 'AC1', oracleTier: 'T1', result: 'pass', detail: 'ok' } });

  event({ type: 'assistant_delta', taskId, content: 'Here is what I did:\n\n', sequence: 0 });
  event({ type: 'assistant_delta', taskId, content: '`\nFile notes.txt created (42 bytes)\n`\n\n', sequence: 1 });
  event({ type: 'assistant_delta', taskId, content: '> **Demo mode.** Real execution needs a DeepSeek API key.', sequence: 2 });

  event({ type: 'final_result', taskId, status: 'done' });
}

// ---- Store ----

export const useChatStore = create<ChatState>()((set, get) => ({
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
  sessionMode: 'standard',
  threads: {},
  taskThreadIds: {},
  pendingThreadIds: [],
  sessions: [],
  activeSessionId: null,
  currentProject: null,
  recentProjects: [],

  _client: null as { startTask: (input: string, mode?: SessionMode) => Promise<unknown>; approveGate?: (gateId: string, decision: 'allow' | 'always' | 'deny') => Promise<unknown>; onEvent?: (cb: (e: unknown) => void) => () => void } | null,
  setClient: (client) => set({ _client: client as typeof client | null }),

  sendMessage: async (text: string) => {
    const state = get();
    const active = activeThreadFromState(state);
    const reuseActive = Boolean(active && active.blocks.length === 0 && active.status === 'idle' && !active.taskId);
    const currentSnapshot = active && !reuseActive && active.blocks.length > 0 ? currentThreadSnapshot(state, active.id) : null;
    const userBlock: UserBlock = { kind: 'user', id: uid(), text };
    const threadId = reuseActive && active ? active.id : uid();
    const createdAt = reuseActive && active ? active.createdAt : nowIso();
    const nextThread = SessionRecordSchema.parse({
      id: threadId,
      title: sessionTitle([userBlock]),
      blocks: [userBlock],
      createdAt,
      updatedAt: nowIso(),
      projectDir: state.currentProject?.path ?? currentSnapshot?.projectDir ?? active?.projectDir ?? null,
      taskId: null,
      status: 'running',
      liveReasoning: '',
      liveAssistant: '',
      liveToolContent: '',
      currentPlan: [],
      error: null,
      costUsd: 0,
      spendUsd: 0,
      model: null,
      mode: state.sessionMode
    });

    set({
      blocks: [userBlock],
      liveReasoning: '',
      liveAssistant: '',
      liveToolContent: '',
      busy: true,
      currentTaskId: null,
      currentPlan: [],
      status: 'running',
      error: null,
      costUsd: 0,
      spendUsd: 0,
      model: null,
      sessionMode: state.sessionMode,
      activeSessionId: threadId,
      pendingThreadIds: reuseActive ? state.pendingThreadIds : [...state.pendingThreadIds, threadId],
      threads: reuseActive
        ? replaceThread(state.threads, nextThread)
        : replaceThread(currentSnapshot ? replaceThread(state.threads, currentSnapshot) : state.threads, nextThread),
      sessions: currentSnapshot ? replaceSession(state.sessions, currentSnapshot) : state.sessions
    });

    const { _client } = get();
    if (_client) {
      await _client.startTask(text, state.sessionMode);
      return;
    }
    if (typeof window !== 'undefined') {
      const bobby = (window as unknown as { bobby?: { send: (cmd: unknown) => Promise<unknown> } }).bobby;
      if (bobby && typeof bobby.send === 'function') {
        await bobby.send({ type: 'startTask', input: text, mode: state.sessionMode });
        return;
      }
    }
    mockReply(text);
  },

  handleEvent: (event: KernelEvent) => {
    const state = get();
    let threadId = resolveThreadId(state, event.taskId);
    if (!threadId && state.activeSessionId) {
      const active = state.threads[state.activeSessionId];
      if (active && (!active.taskId || active.taskId === event.taskId)) {
        threadId = active.id;
      }
    }
    if (!threadId) {
      threadId = state.activeSessionId ?? uid();
    }

    const baseThread = state.threads[threadId] ?? makeBlankSession(threadId, state.currentProject?.path ?? null);
    const threadState = stateFromThread(state, baseThread);
    const partial = reduceEvent(threadState, event);
    if (Object.keys(partial).length === 0) {
      return;
    }

    const nextThread: ThreadRecord = SessionRecordSchema.parse({
      ...baseThread,
      id: threadId,
      title: baseThread.title || sessionTitle(threadState.blocks),
      blocks: (partial.blocks ?? threadState.blocks) as unknown[],
      createdAt: baseThread.createdAt,
      updatedAt: nowIso(),
      projectDir: threadState.currentProject?.path ?? baseThread.projectDir ?? null,
      taskId: partial.currentTaskId ?? threadState.currentTaskId ?? baseThread.taskId ?? (event.type === 'intent_proposed' ? event.taskId : null),
      status: partial.status ?? threadState.status,
      liveReasoning: partial.liveReasoning ?? threadState.liveReasoning,
      liveAssistant: partial.liveAssistant ?? threadState.liveAssistant,
      liveToolContent: partial.liveToolContent ?? threadState.liveToolContent,
      currentPlan: partial.currentPlan ?? threadState.currentPlan,
      error: partial.error ?? threadState.error,
      costUsd: partial.costUsd ?? threadState.costUsd,
      spendUsd: partial.spendUsd ?? threadState.spendUsd,
      model: partial.model ?? threadState.model,
      mode: threadState.sessionMode
    });

    const nextThreads = replaceThread(state.threads, nextThread);
    const nextSessions = replaceSession(state.sessions, nextThread);
    const nextTaskThreadIds = nextThread.taskId ? { ...state.taskThreadIds, [nextThread.taskId]: nextThread.id } : state.taskThreadIds;
    const nextPending = state.pendingThreadIds.filter((pendingId) => pendingId !== nextThread.id);
    const basePatch: Partial<ChatState> = {
      threads: nextThreads,
      sessions: nextSessions,
      taskThreadIds: nextTaskThreadIds,
      pendingThreadIds: nextPending
    };

    if (threadId === state.activeSessionId) {
      set({
        ...basePatch,
        ...resetThreadState(nextThread)
      });
    } else {
      set(basePatch);
    }

    void persistSession(nextThread);
  },

  approveGate: async (gateId: string, decision: 'allow' | 'always' | 'deny') => {
    if (typeof window !== 'undefined' && (window as unknown as { bobby?: { send: (cmd: unknown) => Promise<unknown> } }).bobby) {
      await (window as unknown as { bobby: { send: (cmd: unknown) => Promise<unknown> } }).bobby.send({ type: 'approveGate', gateId, decision });
    }
  },

  approvePlan: async (taskId: string, decision: 'approve' | 'reject' | 'edit', instructions?: string) => {
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.kind === 'plan' ? { ...b, status: decision === 'approve' ? 'approved' as const : 'rejected' as const } : b
      )
    }));

    if (typeof window !== 'undefined' && (window as unknown as { bobby?: { send: (cmd: unknown) => Promise<unknown> } }).bobby) {
      await (window as unknown as { bobby: { send: (cmd: unknown) => Promise<unknown> } }).bobby.send({ type: 'planDecision', taskId, decision, instructions });
    }
  },

  abort: async () => {
    const taskId = get().currentTaskId;
    if (taskId && typeof window !== 'undefined' && (window as unknown as { bobby?: { send: (cmd: unknown) => Promise<unknown> } }).bobby) {
      await (window as unknown as { bobby: { send: (cmd: unknown) => Promise<unknown> } }).bobby.send({ type: 'abort', taskId });
    }
  },

  newSession: () => {
    const state = get();
    const active = activeThreadFromState(state);
    const threadId = uid();
    const blank = makeBlankSession(threadId, state.currentProject?.path ?? active?.projectDir ?? null);
    const nextThreads = replaceThread(state.threads, blank);
    const nextSessions = active && active.blocks.length > 0 ? replaceSession(state.sessions, currentThreadSnapshot(state, active.id)) : state.sessions;
    set({
      ...resetThreadState(blank),
      threads: nextThreads,
      sessions: nextSessions,
      pendingThreadIds: state.pendingThreadIds.filter((pendingId) => pendingId !== threadId)
    });
  },

  switchSession: (id: string) => {
    const state = get();
    const target = state.threads[id] ?? state.sessions.find((session) => session.id === id);
    if (!target) return;
    const active = activeThreadFromState(state);
    const visibleTitle = sessionTitle(active ? (active.blocks as ChatBlock[]) : state.blocks);
    const shouldSnapshotActive = Boolean(
      active &&
      active.blocks.length > 0 &&
      active.id !== target.id &&
      !sameBlocks(active.blocks as ChatBlock[], target.blocks as unknown[]) &&
      !( !state.activeSessionId && visibleTitle === target.title )
    );
    const nextSessions = shouldSnapshotActive
      ? replaceSession(state.sessions, currentThreadSnapshot(state, active!.id))
      : state.sessions;
    if (shouldSnapshotActive && active) {
      void persistSession(currentThreadSnapshot(state, active.id));
    }
    set({
      ...resetThreadState(target),
      sessions: nextSessions,
      threads: replaceThread(state.threads, target),
      taskThreadIds: target.taskId ? { ...state.taskThreadIds, [target.taskId]: target.id } : state.taskThreadIds,
      pendingThreadIds: state.pendingThreadIds.filter((pendingId) => pendingId !== target.id)
    });
  },

  resumeSession: (id: string) => {
    const state = get();
    const target = state.threads[id] ?? state.sessions.find((session) => session.id === id);
    if (!target) return;

    const resume = cloneSessionForResume(target);
    const nextProject = target.projectDir
      ? { name: target.projectDir.split(/[\\/]/).filter(Boolean).at(-1) ?? target.projectDir, path: target.projectDir, lastOpenedAt: nowIso() }
      : state.currentProject;

    set({
      ...resetThreadState(resume),
      currentProject: nextProject,
      sessions: replaceSession(state.sessions, resume),
      threads: replaceThread(state.threads, resume),
      pendingThreadIds: state.pendingThreadIds.filter((pendingId) => pendingId !== resume.id)
    });
  },

  setSessionMode: (mode: SessionMode) => {
    const state = get();
    const activeId = state.activeSessionId;
    if (!activeId) {
      set({ sessionMode: mode });
      return;
    }

    const active = state.threads[activeId] ?? state.sessions.find((session) => session.id === activeId);
    if (!active) {
      set({ sessionMode: mode });
      return;
    }

    const nextThread = SessionRecordSchema.parse({
      ...active,
      mode,
      updatedAt: nowIso()
    });

    set({
      sessionMode: mode,
      threads: replaceThread(state.threads, nextThread),
      sessions: replaceSession(state.sessions, nextThread)
    });
    void persistSession(nextThread);
  },

  clearBlocks: () => set({ blocks: [], liveReasoning: '', liveAssistant: '', liveToolContent: '' }),

  loadProjectState: async () => {
    if (typeof window === 'undefined' || !window.bobby) return;
    const [project, projects] = await Promise.all([
      window.bobby.getCurrentProject?.(),
      window.bobby.listProjects?.()
    ]);
    set({
      currentProject: ProjectMetaSchema.nullable().parse(project ?? null),
      recentProjects: ProjectListSchema.parse(projects ?? [])
    });
  },

  openProject: async () => {
    if (typeof window === 'undefined' || !window.bobby?.openProject) return;
    const result = await window.bobby.openProject();
    if (!result) return;
    set({ currentProject: result.project, recentProjects: result.recentProjects });
  },

  selectProject: async (projectDir: string) => {
    if (typeof window === 'undefined' || !window.bobby?.selectProject) return;
    const result = await window.bobby.selectProject(projectDir);
    set({ currentProject: result.project, recentProjects: result.recentProjects });
  },

  loadSessions: async () => {
    if (typeof window === 'undefined' || !window.bobby?.listSessions) return;
    const parsed = SessionRecordSchema.array().safeParse(await window.bobby.listSessions());
    if (parsed.success) {
      const sessions = dedupeSessions(parsed.data);
      const state = {
        sessions,
        threads: sessions.reduce<Record<string, ThreadRecord>>((accumulator, session) => {
          accumulator[session.id] = session;
          return accumulator;
        }, {}),
        taskThreadIds: sessions.reduce<Record<string, string>>((accumulator, session) => {
          if (session.taskId) {
            accumulator[session.taskId] = session.id;
          }
          return accumulator;
        }, {})
      };
      set(state);

      const lastActiveSessionId = readLastActiveSessionId();
      if (lastActiveSessionId) {
        const target = sessions.find((session) => session.id === lastActiveSessionId);
        if (target) {
          set({
            ...resetThreadState(target),
            sessions: state.sessions,
            threads: state.threads,
            taskThreadIds: state.taskThreadIds,
            currentProject: get().currentProject,
            recentProjects: get().recentProjects,
            _client: get()._client
          });
        }
      }
    }
  }
}));
