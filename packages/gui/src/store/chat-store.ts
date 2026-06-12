import { create } from 'zustand';
import type { Evidence, GateDecision, KernelEvent, PlanStep } from '@bobby/shared';
import {
  ProjectListSchema,
  ProjectMetaSchema,
  SessionRecordSchema,
  type SessionMode,
  type ProjectMeta,
  type SessionRecordDto
} from '../ipc/contract';

export type ChatClient = {
  startTask: (input: string, mode?: SessionMode, taskId?: string) => Promise<unknown>;
  approveGate?: (gateId: string, decision: GateDecision) => Promise<unknown>;
  onEvent?: (cb: (e: unknown) => void) => () => void;
};

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

  // Internal client
  _client: ChatClient | null;
  setClient: (client: ChatClient | null) => void;

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

function makeBlankSession(
  id: string,
  projectDir: string | null,
  createdAt = nowIso(),
  mode: SessionMode = 'standard'
): SessionRecordDto {
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
    mode
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

function reduceToolDelta(state: ChatState, event: Extract<KernelEvent, { type: 'tool_delta' }>): Partial<ChatState> {
  const deltaContent = [event.status, event.tool, event.content].filter(Boolean).join(' ');
  const partial: Partial<ChatState> = {
    liveToolContent: state.liveToolContent ? `${state.liveToolContent} ${deltaContent}` : deltaContent
  };
  const lastTool = [...state.blocks].reverse().find((b) => b.kind === 'tool');
  if (lastTool && lastTool.kind === 'tool') {
    const prevContent = (lastTool as ToolBlock).content;
    partial.blocks = state.blocks.map((b) =>
      b.id === lastTool.id && b.kind === 'tool'
        ? { ...b, content: prevContent ? `${prevContent} ${deltaContent}` : deltaContent, status: 'running' as const }
        : b
    );
  }
  return partial;
}

function reduceFinalResult(state: ChatState, event: Extract<KernelEvent, { type: 'final_result' }>): Partial<ChatState> {
  // Flush live blocks
  const newBlocks: ChatBlock[] = [];
  if (state.liveReasoning) {
    newBlocks.push({ kind: 'reasoning', id: uid(), text: state.liveReasoning });
  }
  if (state.liveAssistant) {
    newBlocks.push({ kind: 'assistant', id: uid(), text: state.liveAssistant });
  }
  newBlocks.push({ kind: 'status', id: uid(), status: event.status });

  return {
    blocks: [...state.blocks, ...newBlocks],
    liveReasoning: '',
    liveAssistant: '',
    liveToolContent: '',
    busy: false,
    status: event.status
  };
}

function reduceUsageDelta(event: Extract<KernelEvent, { type: 'usage_delta' }>): Partial<ChatState> {
  const partial: Partial<ChatState> = {};
  if (event.model) partial.model = event.model;
  if (event.costUsd) partial.costUsd = event.costUsd;
  return partial;
}

export function reduceEvent(state: ChatState, event: KernelEvent): Partial<ChatState> {
  switch (event.type) {
    case 'intent_proposed':
      return { currentTaskId: event.taskId, status: 'running', busy: true };
    case 'direct_answer':
      return { blocks: [...state.blocks, { kind: 'assistant', id: uid(), text: event.text }] };
    case 'plan_ready':
      return {
        currentPlan: event.steps,
        blocks: [...state.blocks, { kind: 'plan', id: uid(), steps: event.steps, status: 'pending' }]
      };
    case 'tool_called':
      return { blocks: [...state.blocks, { kind: 'tool', id: uid(), tool: event.tool, status: 'start', content: '' }] };
    case 'tool_delta':
      return reduceToolDelta(state, event);
    case 'evidence_produced':
      return { blocks: [...state.blocks, { kind: 'evidence', id: uid(), evidence: event.evidence }] };
    case 'verdict':
      if (event.verdict.result === 'pass') {
        return {};
      }
      return {
        blocks: [...state.blocks, { kind: 'verdict', id: uid(), acId: event.verdict.acId, result: event.verdict.result }]
      };
    case 'assistant_delta':
      return { liveAssistant: `${state.liveAssistant}${event.content}` };
    case 'reasoning_delta':
      return { liveReasoning: `${state.liveReasoning}${event.content}` };
    case 'usage_delta':
      return reduceUsageDelta(event);
    case 'gate_request':
      return { blocks: [...state.blocks, { kind: 'gate', id: uid(), gateId: event.gateId, reason: event.reason }] };
    case 'final_result':
      return reduceFinalResult(state, event);
    case 'error':
      return {
        blocks: [...state.blocks, { kind: 'error', id: uid(), message: event.message }],
        error: event.message,
        busy: false,
        status: 'failed'
      };
    default:
      return {};
  }
}

// ---- Mock mode (no backend) ----

function mockReply(text: string, taskId = 'mock-' + Date.now()) {
  const event = (e: KernelEvent) => useChatStore.getState().handleEvent(e);
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

// ---- Action helpers ----

function buildOutgoingThread(
  state: ChatState,
  input: {
    userBlock: UserBlock;
    threadId: string;
    taskId: string;
    createdAt: string;
    active: ThreadRecord | null | undefined;
    currentSnapshot: ThreadRecord | null;
  }
): ThreadRecord {
  return SessionRecordSchema.parse({
    id: input.threadId,
    title: sessionTitle([input.userBlock]),
    blocks: [input.userBlock],
    createdAt: input.createdAt,
    updatedAt: nowIso(),
    projectDir: state.currentProject?.path ?? input.currentSnapshot?.projectDir ?? input.active?.projectDir ?? null,
    taskId: input.taskId,
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
}

function outgoingStatePatch(
  state: ChatState,
  input: {
    userBlock: UserBlock;
    threadId: string;
    taskId: string;
    reuseActive: boolean;
    currentSnapshot: ThreadRecord | null;
    nextThread: ThreadRecord;
  }
): Partial<ChatState> {
  const threadsWithSnapshot = input.currentSnapshot ? replaceThread(state.threads, input.currentSnapshot) : state.threads;
  return {
    blocks: [input.userBlock],
    liveReasoning: '',
    liveAssistant: '',
    liveToolContent: '',
    busy: true,
    currentTaskId: input.taskId,
    currentPlan: [],
    status: 'running',
    error: null,
    costUsd: 0,
    spendUsd: 0,
    model: null,
    sessionMode: state.sessionMode,
    activeSessionId: input.threadId,
    taskThreadIds: { ...state.taskThreadIds, [input.taskId]: input.threadId },
    pendingThreadIds: state.pendingThreadIds.filter((pendingId) => pendingId !== input.threadId),
    threads: input.reuseActive
      ? replaceThread(state.threads, input.nextThread)
      : replaceThread(threadsWithSnapshot, input.nextThread),
    sessions: input.currentSnapshot ? replaceSession(state.sessions, input.currentSnapshot) : state.sessions
  };
}

async function dispatchOutgoingTask(client: ChatClient | null, text: string, mode: SessionMode, taskId: string): Promise<void> {
  if (client) {
    await client.startTask(text, mode, taskId);
    return;
  }
  if (typeof window !== 'undefined') {
    const bobby = (window as unknown as { bobby?: { send: (cmd: unknown) => Promise<unknown> } }).bobby;
    if (bobby && typeof bobby.send === 'function') {
      await bobby.send({ type: 'startTask', input: text, mode, taskId });
      return;
    }
  }
  mockReply(text, taskId);
}

function resolveEventThreadId(state: ChatState, taskId: string): string {
  const resolved = resolveThreadId(state, taskId);
  if (resolved) {
    return resolved;
  }
  return `task-${taskId}`;
}

function mergeThreadEvent(
  baseThread: ThreadRecord,
  threadState: ChatState,
  partial: Partial<ChatState>,
  event: KernelEvent,
  threadId: string
): ThreadRecord {
  return SessionRecordSchema.parse({
    ...baseThread,
    id: threadId,
    title: baseThread.title || sessionTitle(threadState.blocks),
    blocks: (partial.blocks ?? threadState.blocks) as unknown[],
    createdAt: baseThread.createdAt,
    updatedAt: nowIso(),
    projectDir: threadState.currentProject?.path ?? baseThread.projectDir ?? null,
    taskId: partial.currentTaskId ?? threadState.currentTaskId ?? baseThread.taskId ?? event.taskId,
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
}

// ---- Store ----

// eslint-disable-next-line max-lines-per-function -- zustand store definition: one literal wiring state fields to thin actions
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

  _client: null as ChatClient | null,
  setClient: (client) => set({ _client: client }),

  sendMessage: async (text: string) => {
    const state = get();
    const active = activeThreadFromState(state);
    const reuseActive = Boolean(active && active.blocks.length === 0 && active.status === 'idle' && !active.taskId);
    const currentSnapshot = active && !reuseActive && active.blocks.length > 0 ? currentThreadSnapshot(state, active.id) : null;
    const userBlock: UserBlock = { kind: 'user', id: uid(), text };
    const threadId = reuseActive && active ? active.id : uid();
    const taskId = `task-${threadId}`;
    const createdAt = reuseActive && active ? active.createdAt : nowIso();
    const nextThread = buildOutgoingThread(state, { userBlock, threadId, taskId, createdAt, active, currentSnapshot });

    set(outgoingStatePatch(state, { userBlock, threadId, taskId, reuseActive, currentSnapshot, nextThread }));
    await dispatchOutgoingTask(get()._client, text, state.sessionMode, taskId);
  },

  handleEvent: (event: KernelEvent) => {
    const state = get();
    const threadId = resolveEventThreadId(state, event.taskId);
    const baseThread = state.threads[threadId] ?? makeBlankSession(threadId, state.currentProject?.path ?? null);
    const threadState = stateFromThread(state, baseThread);
    const partial = reduceEvent(threadState, event);
    if (Object.keys(partial).length === 0) {
      return;
    }

    const nextThread = mergeThreadEvent(baseThread, threadState, partial, event, threadId);
    const basePatch: Partial<ChatState> = {
      threads: replaceThread(state.threads, nextThread),
      sessions: replaceSession(state.sessions, nextThread),
      taskThreadIds: nextThread.taskId ? { ...state.taskThreadIds, [nextThread.taskId]: nextThread.id } : state.taskThreadIds,
      pendingThreadIds: state.pendingThreadIds.filter((pendingId) => pendingId !== nextThread.id)
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
    const blank = makeBlankSession(
      threadId,
      state.currentProject?.path ?? active?.projectDir ?? null,
      nowIso(),
      state.sessionMode
    );
    const nextThreads = replaceThread(state.threads, blank);
    const nextSessions = active && active.blocks.length > 0 ? replaceSession(state.sessions, currentThreadSnapshot(state, active.id)) : state.sessions;
    set({
      ...resetThreadState(blank),
      threads: nextThreads,
      sessions: nextSessions,
      pendingThreadIds: state.pendingThreadIds.filter((pendingId) => pendingId !== threadId)
    });
    void persistSession(blank);
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
    const nextProject = target.projectDir
      ? {
          name: target.projectDir.split(/[\\/]/).filter(Boolean).at(-1) ?? target.projectDir,
          path: target.projectDir,
          lastOpenedAt: nowIso()
        }
      : state.currentProject;
    set({
      ...resetThreadState(target),
      sessions: nextSessions,
      threads: replaceThread(state.threads, target),
      taskThreadIds: target.taskId ? { ...state.taskThreadIds, [target.taskId]: target.id } : state.taskThreadIds,
      pendingThreadIds: state.pendingThreadIds.filter((pendingId) => pendingId !== target.id),
      currentProject: nextProject
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
    void persistSession(resume);
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
          const nextProject = target.projectDir
            ? {
                name: target.projectDir.split(/[\\/]/).filter(Boolean).at(-1) ?? target.projectDir,
                path: target.projectDir,
                lastOpenedAt: nowIso()
              }
            : get().currentProject;
          set({
            ...resetThreadState(target),
            sessions: state.sessions,
            threads: state.threads,
            taskThreadIds: state.taskThreadIds,
            currentProject: nextProject,
            recentProjects: get().recentProjects,
            _client: get()._client
          });
        }
      }
    }
  }
}));
