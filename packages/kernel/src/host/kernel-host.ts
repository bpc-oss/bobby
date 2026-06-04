import type { ModelClient } from '../model/model-client';
import { KernelCommandSchema, type KernelCommand, type KernelEvent } from '@bobby/shared';
import type { ConscienceDeps } from '../brain/orchestrator';
import { Orchestrator } from '../brain/orchestrator';
import { TraceStore } from '../trace/trace-store';

type Listener = (event: KernelEvent) => void;
type GateDecision = 'allow' | 'deny';

export class KernelHost {
  private readonly listeners = new Set<Listener>();
  private readonly pendingGateResolvers = new Map<string, (decision: GateDecision) => void>();
  private readonly trace = new TraceStore();
  private readonly sessionAnswers = new Map<string, string[]>();
  private readonly abortedTasks = new Set<string>();

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
    const orchestrator = new Orchestrator(this.makeModel(), this.conscienceDeps);
    orchestrator.on((event) => this.emit(event));
    await orchestrator.startTask(cmd.input);
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
}
