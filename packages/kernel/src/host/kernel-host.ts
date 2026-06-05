import type { ModelClient } from '../model/model-client';
import { KernelCommandSchema, type KernelCommand, type KernelEvent } from '@bobby/shared';
import type { ConscienceDeps } from '../brain/orchestrator';
import { Orchestrator } from '../brain/orchestrator';
import { TraceStore } from '../trace/trace-store';
import { classifyIntent } from '../brain/triage';

type Listener = (event: KernelEvent) => void;
type GateDecision = 'allow' | 'deny';

export class KernelHost {
  private readonly listeners = new Set<Listener>();
  private readonly pendingGateResolvers = new Map<string, (decision: GateDecision) => void>();
  private readonly trace = new TraceStore();
  private readonly sessionAnswers = new Map<string, string[]>();
  private readonly abortedTasks = new Set<string>();
  private taskCounter = 0;

  constructor(
    private readonly makeModel: () => ModelClient,
    private readonly conscienceDeps?: ConscienceDeps
  ) {}

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(event: KernelEvent): void {
    if ('taskId' in event && typeof event.taskId === 'string' && event.taskId.length > 0) {
      this.trace.append(event.taskId, event);
    }

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  getTrace(taskId: string): readonly KernelEvent[] {
    return this.trace.get(taskId);
  }

  getAnswers(taskId: string): readonly string[] {
    return Object.freeze([...(this.sessionAnswers.get(taskId) ?? [])]);
  }

  isAborted(taskId: string): boolean {
    return this.abortedTasks.has(taskId);
  }

  async send(cmd: KernelCommand): Promise<void> {
    const parsed = KernelCommandSchema.parse(cmd);

    switch (parsed.type) {
      case 'startTask':
        await this.handleStartTask(parsed);
        break;
      case 'answer':
        await this.handleAnswer(parsed);
        break;
      case 'approveGate':
        this.handleApproveGate(parsed);
        break;
      case 'abort':
        await this.handleAbort(parsed);
        break;
      case 'getTrace':
        await this.handleGetTrace(parsed);
        break;
      default:
        break;
    }
  }

  private async handleStartTask(cmd: { type: 'startTask'; input: string }): Promise<void> {
    const intent = await classifyIntent(cmd.input);
    const taskId = this.makeTaskId();

    switch (intent) {
      case 'GREETING': {
        this.emit({
          type: 'direct_answer',
          taskId,
          text: '你好，我在的，需要我帮你做点什么？'
        });
        return;
      }
      case 'QUESTION': {
        this.emit({
          type: 'direct_answer',
          taskId,
          text: '我先给你一个简短回复：我已收到你的问题，先放到会话里后续继续。'
        });
        return;
      }
      case 'COMMAND': {
        this.emit({
          type: 'direct_answer',
          taskId,
          text: '命令类输入先做保守处理：我先不执行文件改动相关操作。'
        });
        return;
      }
      case 'TASK':
      default: {
        try {
          const orchestrator = new Orchestrator(this.makeModel(), this.conscienceDeps);
          orchestrator.on((event) => this.emit(event));
          await orchestrator.startTask(cmd.input);
        } catch (error: unknown) {
          // Never let a task error crash the host/CLI: surface it as an
          // error event + a failed final_result so the UI can render it.
          const message = error instanceof Error ? error.message : String(error);
          this.emit({ type: 'error', taskId, message });
          this.emit({ type: 'final_result', taskId, status: 'failed' });
        }
        return;
      }
    }
  }

  private async handleAnswer(cmd: { type: 'answer'; taskId: string; reply: string }): Promise<void> {
    const current = this.sessionAnswers.get(cmd.taskId) ?? [];
    current.push(cmd.reply);
    this.sessionAnswers.set(cmd.taskId, current);
    return;
  }

  private handleApproveGate(cmd: { type: 'approveGate'; gateId: string; decision: GateDecision }): void {
    const resolve = this.pendingGateResolvers.get(cmd.gateId);
    if (!resolve) {
      return;
    }

    this.pendingGateResolvers.delete(cmd.gateId);
    resolve(cmd.decision);
  }

  private async handleAbort(_cmd: { type: 'abort'; taskId: string }): Promise<void> {
    this.abortedTasks.add(_cmd.taskId);
    return;
  }

  private async handleGetTrace(_cmd: { type: 'getTrace'; taskId: string }): Promise<void> {
    void this.getTrace(_cmd.taskId);
    return;
  }

  requestGate(taskId: string, gateId: string, reason: string): Promise<GateDecision> {
    return new Promise<GateDecision>((resolve) => {
      this.pendingGateResolvers.set(gateId, resolve);
      this.emit({
        type: 'gate_request',
        taskId,
        gateId,
        reason
      });
    });
  }

  private makeTaskId(): string {
    this.taskCounter += 1;
    return `task-${Date.now()}-${this.taskCounter}`;
  }
}
