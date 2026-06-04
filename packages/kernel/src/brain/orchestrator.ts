import { type Evidence, KernelEvent, type Verdict } from '@bobby/shared';
import { captureIntent } from './intent';
import { executeStep } from './executor';
import { planTask } from './planner';
import { TraceStore } from '../trace/trace-store';
import type { ModelClient } from '../model/model-client';
import type { VerificationEngine } from '../conscience/engine';
import type { CompletionGate } from '../conscience/gate';

type Listener = (event: KernelEvent) => void;
let taskCounter = 0;

const createTaskId = (): string => {
  taskCounter += 1;
  return `task-${Date.now()}-${taskCounter}`;
};

export interface ConscienceDeps {
  engine: VerificationEngine;
  gate: CompletionGate;
  evidenceFor: (stepId: string, acIds: string[]) => Evidence[] | Promise<Evidence[]>;
}

export class Orchestrator {
  readonly trace = new TraceStore();
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly model: ModelClient,
    private readonly conscience?: ConscienceDeps
  ) {}

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(taskId: string, event: KernelEvent): void {
    this.trace.append(taskId, event);
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  async startTask(input: string): Promise<string> {
    const taskId = createTaskId();

    const contract = await captureIntent(this.model, input);
    this.emit(taskId, { type: 'intent_proposed', taskId, contract });

    const steps = await planTask(this.model, contract);
    this.emit(taskId, { type: 'plan_ready', taskId, steps });
    const verdicts = new Map<string, Verdict>();

    for (const step of steps) {
      this.emit(taskId, { type: 'step_started', taskId, stepId: step.id });
      await executeStep(this.model, step);

      if (!this.conscience) {
        continue;
      }

      const evidence = await this.conscience.evidenceFor(step.id, step.satisfiesAcIds);
      for (const e of evidence) {
        this.emit(taskId, { type: 'evidence_produced', taskId, evidence: e });
      }

      const relevantAcs = contract.acceptanceCriteria.filter((ac) => step.satisfiesAcIds.includes(ac.id));
      for (const ac of relevantAcs) {
        const verdict = await this.conscience.engine.verify(ac, evidence);
        verdicts.set(ac.id, verdict);
        this.emit(taskId, { type: 'verdict', taskId, verdict });
      }
    }

    let status: 'done' | 'failed' | 'blocked' = 'failed';
    if (this.conscience) {
      status = this.conscience.gate.evaluate(contract, verdicts, []).status;
    }

    this.emit(taskId, { type: 'final_result', taskId, status });
    return taskId;
  }
}
