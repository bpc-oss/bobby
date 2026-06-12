import type { GuiEvent, KernelClient, SessionMeta, SessionMode } from '../client';
import type { SessionScript } from './fixtures';

export class MockKernelClient implements KernelClient {
  private listeners = new Set<(event: GuiEvent) => void>();
  private scripts: Map<string, SessionScript>;
  private extraSessions: SessionMeta[] = [];
  private paused = new Map<string, { taskId: string; resume: () => void }>();
  private seq = 0;

  constructor(fixtures: Record<string, SessionScript>) {
    this.scripts = new Map(Object.values(fixtures).map((script) => [script.meta.id, script]));
  }

  async listSessions(mode: SessionMode): Promise<SessionMeta[]> {
    const fromScripts = [...this.scripts.values()].map((script) => script.meta);
    return [...fromScripts, ...this.extraSessions].filter((meta) => meta.mode === mode);
  }

  async createSession(mode: SessionMode): Promise<SessionMeta> {
    this.seq += 1;

    const meta: SessionMeta = {
      id: `new-${this.seq}`,
      mode,
      title: mode === 'chat' ? 'New Chat' : 'New Session',
      pinned: false,
      status: 'idle',
      updatedAt: new Date().toISOString()
    };

    this.extraSessions.push(meta);
    this.emit({ kind: 'session_meta', session: meta });
    return meta;
  }

  async startTask(sessionId: string, input: string): Promise<void> {
    void input;
    const script = this.scripts.get(sessionId);
    if (!script || script.listOnly) {
      return;
    }

    this.playFrom(sessionId, script, 0);
  }

  async approveGate(
    sessionId: string,
    _gateId: string,
    decision: 'allow' | 'deny'
  ): Promise<void> {
    const pause = this.paused.get(sessionId);
    if (!pause) {
      return;
    }

    this.paused.delete(sessionId);
    if (decision === 'allow') {
      pause.resume();
      return;
    }

    this.emit({
      kind: 'kernel',
      sessionId,
      event: { type: 'final_result', taskId: pause.taskId, status: 'blocked' }
    });
  }

  onEvent(cb: (event: GuiEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(event: GuiEvent): void {
    for (const cb of this.listeners) {
      cb(event);
    }
  }

  private playFrom(sessionId: string, script: SessionScript, index: number): void {
    if (index >= script.steps.length) {
      return;
    }

    const step = script.steps[index];
    setTimeout(() => {
      if (step.emit.kind === 'kernel') {
        this.emit({ kind: 'kernel', sessionId, event: step.emit.event });
        if (step.emit.event.type === 'gate_request') {
          const taskId = step.emit.event.taskId;
          this.paused.set(sessionId, {
            taskId,
            resume: () => this.playFrom(sessionId, script, index + 1)
          });
          return;
        }
      } else {
        this.emit({ kind: 'usage', sessionId, usage: step.emit.usage });
      }

      this.playFrom(sessionId, script, index + 1);
    }, step.afterMs);
  }
}
