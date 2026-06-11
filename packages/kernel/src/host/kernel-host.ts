import type { ModelClient } from '../model/model-client';
import {
  KernelCommandSchema,
  type GateDecision,
  type KernelCommand,
  type KernelEvent,
  type SessionMode,
  type PlanDecision
} from '@bobby/shared';
import type { ConscienceDeps } from '../brain/orchestrator';
import { Orchestrator } from '../brain/orchestrator';
import { TraceStore } from '../trace/trace-store';
import { classifyIntent } from '../brain/triage';
import { listSnapshots, type SnapshotListEntry, restoreSnapshot as restoreSnapshotFromDisk } from '../hands/snapshot';
import type { Tier } from '../hands/permission';
import { loadSubAgents, type SubAgentLoadResult } from '../subagent/agent-loader';

type Listener = (event: KernelEvent) => void;
type FinalStatus = Extract<KernelEvent, { type: 'final_result' }>['status'];

type ResumeSummary = {
  taskId: string;
  events: number;
  status: FinalStatus | 'running';
};

const MODE_PERMISSION_CEILING: Record<SessionMode, Tier | undefined> = {
  'plan-only': undefined,
  standard: 'L2',
  enhanced: 'L3',
  full: 'L4'
};

export class KernelHost {
  private readonly listeners = new Set<Listener>();
  private readonly pendingGateResolvers = new Map<string, (decision: GateDecision) => void>();
  private readonly pendingGateReasons = new Map<string, string>();
  private readonly pendingPlanDecisionResolvers = new Map<string, (decision: PlanDecision) => void>();
  private readonly alwaysApprovedGateReasons = new Set<string>();
  private readonly trace: TraceStore;
  private readonly sessionAnswers = new Map<string, string[]>();
  private readonly abortedTasks = new Set<string>();
  private taskCounter = 0;
  private readonly taskSequence: string[] = [];
  private readonly knownTaskIds = new Set<string>();

  constructor(
    private readonly makeModel: () => ModelClient,
    private readonly conscienceDeps?: ConscienceDeps,
    private readonly workspaceRoot: string = process.cwd(),
    enableTracePersistence = workspaceRoot !== process.cwd()
  ) {
    this.trace = new TraceStore({
      workspaceRoot,
      persistence: enableTracePersistence
    });
  }

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

    try {
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
        case 'planDecision':
          this.handlePlanDecision(parsed);
          break;
        case 'abort':
          await this.handleAbort(parsed);
          break;
        case 'getTrace':
          await this.handleGetTrace(parsed);
          break;
        case 'listAgents':
          await this.handleListAgents();
          break;
        case 'restoreSnapshot':
          await this.handleRestoreSnapshot(parsed.snapshotId);
          break;
        case 'resumeSession':
          await this.handleResumeSession();
          break;
        default:
          break;
      }
    } catch (error: unknown) {
      this.emitError('system', error instanceof Error ? error.message : String(error));
    }
  }

  private getMostRecentTrace(): ResumeSummary | null {
    for (let index = this.taskSequence.length - 1; index >= 0; index -= 1) {
      const taskId = this.taskSequence[index];
      if (!this.knownTaskIds.has(taskId)) {
        continue;
      }

      const events = this.trace.get(taskId);
      if (events.length === 0) {
        continue;
      }

      const final = [...events].reverse().find((event): event is Extract<KernelEvent, { type: 'final_result' }> => {
        return event.type === 'final_result';
      });
      return {
        taskId,
        events: events.length,
        status: final?.status ?? 'running'
      };
    }

    const persistedSummary = this.trace.getLatestSummary();
    if (persistedSummary) {
      return persistedSummary;
    }

    return null;
  }

  private emitError(taskId: string, message: string): void {
    this.emit({
      type: 'error',
      taskId,
      message
    });
  }

  private emitDirectAnswer(taskId: string, text: string): void {
    this.emit({
      type: 'direct_answer',
      taskId,
      text
    });
  }

  private async handleStartTask(cmd: { type: 'startTask'; input: string; mode?: SessionMode }): Promise<void> {
    const intent = await classifyIntent(cmd.input);
    const taskId = this.makeTaskId();

    if (!this.knownTaskIds.has(taskId)) {
      this.knownTaskIds.add(taskId);
      this.taskSequence.push(taskId);
    }

    switch (intent) {
      case 'GREETING': {
        this.emitDirectAnswer(taskId, '你好，我在的，需要我帮你做点什么？');
        return;
      }
      case 'QUESTION': {
        this.emitDirectAnswer(
          taskId,
          '我先给你一个简短回复：我已收到你的问题，先放到会话里后续继续。'
        );
        return;
      }
      case 'COMMAND': {
        this.emitDirectAnswer(taskId, '命令类输入先做保守处理：我先不执行文件改动相关操作。');
        return;
      }
      case 'UNCLEAR': {
        this.emitDirectAnswer(taskId, '你想让我具体做什么？请给我一个明确任务或要修改的文件。');
        return;
      }
      case 'TASK':
      default: {
        await this.handleTaskIntent(taskId, cmd.input, cmd.mode);
        return;
      }
    }
  }

  private async handleTaskIntent(taskId: string, input: string, mode?: SessionMode): Promise<void> {
    try {
      const orchestrator = new Orchestrator(
        this.makeModel(),
        this.conscienceDeps,
        this.requestPlanDecision.bind(this),
        {
          planOnly: mode === 'plan-only',
          toolPermissionCeiling: MODE_PERMISSION_CEILING[mode ?? 'standard']
        }
      );
      orchestrator.on((event) => this.emit(event));
      await orchestrator.startTask(input, taskId);
    } catch (error: unknown) {
      // Never let a task error crash the host/CLI: surface it as an
      // error event + a failed final_result so the UI can render it.
      const message = error instanceof Error ? error.message : String(error);
      this.emit({ type: 'error', taskId, message });
      this.emit({ type: 'final_result', taskId, status: 'failed' });
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
    const reason = this.pendingGateReasons.get(cmd.gateId);
    this.pendingGateReasons.delete(cmd.gateId);

    if (cmd.decision === 'always' && reason !== undefined) {
      this.alwaysApprovedGateReasons.add(reason);
    }

    resolve(cmd.decision);
  }

  private handlePlanDecision(cmd: {
    type: 'planDecision';
    taskId: string;
    decision: 'approve' | 'reject' | 'edit';
    instructions?: string;
  }): void {
    const resolve = this.pendingPlanDecisionResolvers.get(cmd.taskId);
    if (!resolve) {
      return;
    }

    this.pendingPlanDecisionResolvers.delete(cmd.taskId);
    if (cmd.decision === 'edit') {
      resolve({ decision: 'edit', instructions: cmd.instructions ?? '' });
      return;
    }

    resolve({ decision: cmd.decision });
  }

  private async handleAbort(_cmd: { type: 'abort'; taskId: string }): Promise<void> {
    this.abortedTasks.add(_cmd.taskId);

    const planDecisionResolver = this.pendingPlanDecisionResolvers.get(_cmd.taskId);
    if (planDecisionResolver) {
      this.pendingPlanDecisionResolvers.delete(_cmd.taskId);
      planDecisionResolver({ decision: 'reject' });
    }

    return;
  }

  private async handleGetTrace(_cmd: { type: 'getTrace'; taskId: string }): Promise<void> {
    void this.getTrace(_cmd.taskId);
    return;
  }

  private async handleListAgents(): Promise<void> {
    try {
      const result: SubAgentLoadResult = loadSubAgents(this.workspaceRoot);
      if (result.agents.length === 0 && result.diagnostics.length === 0) {
        this.emitDirectAnswer('system', 'agents: no agents');
        return;
      }

      const lines: string[] = [];
      if (result.agents.length > 0) {
        lines.push(`agents: found ${result.agents.length}`);
        for (const agent of result.agents) {
          lines.push(`${agent.name}: ${agent.description}`);
        }
      }

      for (const diagnostic of result.diagnostics) {
        lines.push(`diagnostic: ${diagnostic.message}`);
      }

      if (lines.length === 0) {
        this.emitDirectAnswer('system', 'agents: no agents or diagnostics');
        return;
      }

      this.emitDirectAnswer('system', lines.join('\n'));
    } catch (error: unknown) {
      this.emitError('system', `agents: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleRestoreSnapshot(snapshotId?: string): Promise<void> {
    let snapshots: SnapshotListEntry[] = [];
    try {
      snapshots = await listSnapshots(this.workspaceRoot);
    } catch (error: unknown) {
      this.emitError('system', `undo: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    if (snapshots.length === 0) {
      if (snapshotId !== undefined) {
        this.emitError('system', `undo: snapshot not found: ${snapshotId}`);
        return;
      }

      this.emitDirectAnswer('system', 'undo: no snapshots available');
      return;
    }

    const target =
      snapshotId === undefined ? snapshots[0] : snapshots.find((snapshot) => snapshot.id === snapshotId);
    if (!target) {
      this.emitError('system', `undo: snapshot not found: ${snapshotId}`);
      return;
    }

    try {
      const restoredCount = target.copied.length;
      await restoreSnapshotFromDisk(this.workspaceRoot, target.id);
      this.emitDirectAnswer('system', `undo: restored snapshot ${target.id} files=${restoredCount}`);
    } catch (error: unknown) {
      this.emitError('system', `undo: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleResumeSession(): Promise<void> {
    const summary = this.getMostRecentTrace();
    if (!summary) {
      this.emitDirectAnswer('system', 'resume: no resumable trace in current process');
      return;
    }

    this.emitDirectAnswer(
      'system',
      `resume: task=${summary.taskId} events=${summary.events} status=${summary.status}`
    );
  }

  requestGate(taskId: string, gateId: string, reason: string): Promise<GateDecision> {
    if (this.alwaysApprovedGateReasons.has(reason)) {
      return Promise.resolve('always');
    }

    return new Promise<GateDecision>((resolve) => {
      this.pendingGateResolvers.set(gateId, resolve);
      this.pendingGateReasons.set(gateId, reason);
      this.emit({
        type: 'gate_request',
        taskId,
        gateId,
        reason
      });
    });
  }

  requestPlanDecision(taskId: string): Promise<PlanDecision> {
    return new Promise<PlanDecision>((resolve) => {
      this.pendingPlanDecisionResolvers.set(taskId, resolve);
    });
  }

  private makeTaskId(): string {
    this.taskCounter += 1;
    const taskId = `task-${Date.now()}-${this.taskCounter}`;
    return taskId;
  }
}
