import { create } from 'zustand';
import type { Evidence, KernelEvent, PlanStep } from '@bobby/shared';
import {
  ProjectListSchema,
  ProjectMetaSchema,
  SessionRecordSchema,
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
  loadProjectState: () => Promise<void>;
  openProject: () => Promise<void>;
  selectProject: (projectDir: string) => Promise<void>;
  loadSessions: () => Promise<void>;
};

// ---- Helpers ----

let nextId = 1;
const uid = (): string => `b${nextId++}`;

function nowIso(): string {
  return new Date().toISOString();
}

function sessionTitle(blocks: ChatBlock[]): string {
  return blocks.find((b) => b.kind === 'user')?.text?.slice(0, 80) || 'New session';
}

function snapshotSession(state: ChatState, id = state.activeSessionId ?? uid()): SessionRecordDto {
  const createdAt = state.sessions.find((session) => session.id === id)?.createdAt ?? nowIso();
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
    model: state.model
  });
}

function replaceSession(sessions: SessionRecordDto[], next: SessionRecordDto): SessionRecordDto[] {
  const filtered = sessions.filter((session) => session.id !== next.id);
  return [next, ...filtered].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
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
    activeSessionId: session?.id ?? null
  };
}

function stateFromSession(base: ChatState, session: SessionRecordDto): ChatState {
  return {
    ...base,
    ...resetLiveState(session),
    sessions: base.sessions,
    currentProject: base.currentProject,
    recentProjects: base.recentProjects,
    _client: base._client
  };
}

async function persistSession(session: SessionRecordDto): Promise<void> {
  try {
    await window.bobby?.saveSession?.(session);
  } catch {
    // Persistence is best-effort; renderer state remains authoritative for the current turn.
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
  sessions: [],
  activeSessionId: null,
  currentProject: null,
  recentProjects: [],

  _client: null as { startTask: (input: string) => Promise<unknown>; approveGate?: (gateId: string, decision: 'allow' | 'always' | 'deny') => Promise<unknown>; onEvent?: (cb: (e: unknown) => void) => () => void } | null,
  setClient: (client) => set({ _client: client as typeof client | null }),

  sendMessage: async (text: string) => {
    const block: UserBlock = { kind: 'user', id: uid(), text };
    const nextActiveSessionId = get().activeSessionId ?? uid();
    set((s) => ({
      ...(s.busy && s.blocks.length > 0
        ? {
            sessions: replaceSession(s.sessions, snapshotSession(s)),
            blocks: [block],
            activeSessionId: uid(),
            currentTaskId: null,
            currentPlan: []
          }
        : {
            blocks: [...s.blocks, block],
            activeSessionId: s.activeSessionId ?? nextActiveSessionId
          }),
      busy: true,
      status: 'running',
      error: null,
      liveReasoning: '',
      liveAssistant: '',
      liveToolContent: ''
    }));

    const { _client } = get();
    if (_client) {
      await _client.startTask(text);
      return;
    }
    if (typeof window !== 'undefined') {
      const bobby = (window as unknown as { bobby?: { send: (cmd: unknown) => Promise<unknown> } }).bobby;
      if (bobby && typeof bobby.send === 'function') {
        await bobby.send({ type: 'startTask', input: text });
        return;
      }
    }
    // Mock mode: simulate response when no backend
    mockReply(text);
  },

  handleEvent: (event: KernelEvent) => {
    const state = get();
    const targetSession = state.currentTaskId !== event.taskId
      ? state.sessions.find((session) => session.taskId === event.taskId)
      : undefined;

    if (targetSession) {
      const sessionState = stateFromSession(state, targetSession);
      const partial = reduceEvent(sessionState, event);
      if (Object.keys(partial).length > 0) {
        const nextSession = snapshotSession({ ...sessionState, ...partial }, targetSession.id);
        set({ sessions: replaceSession(state.sessions, nextSession) });
        void persistSession(nextSession);
      }
      return;
    }

    const partial = reduceEvent(state, event);
    if (Object.keys(partial).length > 0) {
      set(partial);
      const nextState = get();
      if (nextState.blocks.length > 0) {
        void persistSession(snapshotSession(nextState));
      }
    }
  },

  approveGate: async (gateId: string, decision: 'allow' | 'always' | 'deny') => {
    if (typeof window !== 'undefined' && (window as unknown as { bobby?: { send: (cmd: unknown) => Promise<unknown> } }).bobby) {
      await (window as unknown as { bobby: { send: (cmd: unknown) => Promise<unknown> } }).bobby.send({ type: 'approveGate', gateId, decision });
    }
  },

  approvePlan: async (taskId: string, decision: 'approve' | 'reject' | 'edit', instructions?: string) => {
    // Update plan block status
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
    const s = get();
    if (s.blocks.length > 0) {
      const session = snapshotSession(s);
      void persistSession(session);
      set({
        sessions: replaceSession(s.sessions, session),
        ...resetLiveState(undefined)
      });
    }
  },
  switchSession: (id: string) => {
    const s = get();
    let sessions = s.sessions;
    const target = sessions.find(x => x.id === id);
    if (!target) return;
    const visibleTitle = sessionTitle(s.blocks);
    if (s.activeSessionId === id || sameBlocks(s.blocks, target.blocks) || (!s.activeSessionId && visibleTitle === target.title)) {
      set({ sessions: dedupeSessions(sessions), ...resetLiveState(target) });
      return;
    }
    if (s.blocks.length > 0) {
      const current = snapshotSession(s);
      sessions = replaceSession(s.sessions, current);
      void persistSession(current);
    }
    set({ sessions: dedupeSessions(sessions), ...resetLiveState(target) });
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
    if (parsed.success) set({ sessions: dedupeSessions(parsed.data) });
  }
}));
