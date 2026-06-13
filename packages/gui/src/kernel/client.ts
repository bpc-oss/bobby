import type { KernelEvent } from '@bobby/shared';

export type SessionMode = 'chat' | 'code';
export type SessionStatus = 'idle' | 'running' | 'gate' | 'done' | 'failed';

export interface SessionLinkedAgent {
  name: string;
  detail?: string;
}

export interface SessionLinkedBrowser {
  label: string;
  detail?: string;
}

export interface SessionLinkedSource {
  label: string;
  detail?: string;
}

export interface SessionMeta {
  id: string;
  mode: SessionMode;
  title: string;
  project?: string;
  branch?: string;
  agents?: SessionLinkedAgent[];
  browsers?: SessionLinkedBrowser[];
  sources?: SessionLinkedSource[];
  pinned: boolean;
  status: SessionStatus;
  updatedAt: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheHitRate: number;
  cny: number;
}

export function emptyUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, cacheHitRate: -1, cny: 0 };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheHitRate: b.cacheHitRate >= 0 ? b.cacheHitRate : a.cacheHitRate,
    cny: Number((a.cny + b.cny).toFixed(4))
  };
}

export type GuiEvent =
  | { kind: 'kernel'; sessionId: string; event: KernelEvent }
  | { kind: 'usage'; sessionId: string; usage: Usage }
  | { kind: 'session_meta'; session: SessionMeta };

export interface KernelClient {
  listSessions(mode: SessionMode): Promise<SessionMeta[]>;
  createSession(mode: SessionMode): Promise<SessionMeta>;
  startTask(sessionId: string, input: string): Promise<void>;
  approveGate(
    sessionId: string,
    gateId: string,
    decision: 'allow' | 'deny'
  ): Promise<void>;
  onEvent(cb: (event: GuiEvent) => void): () => void;
}
