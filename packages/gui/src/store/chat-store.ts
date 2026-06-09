import { create } from 'zustand';
import type { Evidence, KernelEvent, PlanStep } from '@bobby/shared';

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
  sessions: { id: string; title: string; blocks: ChatBlock[]; createdAt: string }[];
  activeSessionId: string | null;

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
};

// ---- Helpers ----

let nextId = 1;
const uid = (): string => `b${nextId++}`;

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

  _client: null as { startTask: (input: string) => Promise<unknown>; approveGate?: (gateId: string, decision: 'allow' | 'always' | 'deny') => Promise<unknown>; onEvent?: (cb: (e: unknown) => void) => () => void } | null,
  setClient: (client) => set({ _client: client as typeof client | null }),

  sendMessage: async (text: string) => {
    const block: UserBlock = { kind: 'user', id: uid(), text };
    set((s) => ({
      blocks: [...s.blocks, block],
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
    const partial = reduceEvent(state, event);
    if (Object.keys(partial).length > 0) {
      set(partial);
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
      const title = s.blocks.find(b => b.kind === 'user')?.text?.slice(0, 50) || 'New session';
      const session = { id: uid(), title, blocks: [...s.blocks], createdAt: new Date().toISOString() };
      set({ sessions: [...s.sessions, session], blocks: [], liveReasoning: '', liveAssistant: '', liveToolContent: '', status: 'idle', busy: false, activeSessionId: null });
    }
  },
  switchSession: (id: string) => {
    const s = get();
    // Save current
    if (s.blocks.length > 0) {
      const title = s.blocks.find(b => b.kind === 'user')?.text?.slice(0, 50) || 'Session';
      const current = { id: s.activeSessionId || uid(), title, blocks: [...s.blocks], createdAt: new Date().toISOString() };
      const existing = s.sessions.findIndex(x => x.id === current.id);
      const updated = existing >= 0 ? s.sessions.map((x, i) => i === existing ? current : x) : [...s.sessions, current];
      const target = updated.find(x => x.id === id);
      set({ sessions: updated, blocks: target ? [...target.blocks] : [], liveReasoning: '', liveAssistant: '', liveToolContent: '', status: 'idle', busy: false, activeSessionId: id });
      return;
    }
    const target = s.sessions.find(x => x.id === id);
    if (target) set({ blocks: [...target.blocks], activeSessionId: id, liveReasoning: '', liveAssistant: '', liveToolContent: '', status: 'idle', busy: false });
  },
  clearBlocks: () => set({ blocks: [], liveReasoning: '', liveAssistant: '', liveToolContent: '' })
}));
