import { KernelEvent } from '@bobby/shared';
import { captureIntent } from './intent';
import { executeStep } from './executor';
import { planTask } from './planner';
import { TraceStore } from '../trace/trace-store';
import type { ModelClient } from '../model/model-client';

type Listener = (event: KernelEvent) => void;
let taskCounter = 0;

const createTaskId = (): string => {
  taskCounter += 1;
  return `task-${Date.now()}-${taskCounter}`;
};

export class Orchestrator {
  readonly trace = new TraceStore();
  private readonly listeners = new Set<Listener>();

  constructor(private readonly model: ModelClient) {}

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

    for (const step of steps) {
      this.emit(taskId, { type: 'step_started', taskId, stepId: step.id });
      await executeStep(this.model, step);
    }

    this.emit(taskId, { type: 'final_result', taskId, status: 'failed' });
    return taskId;
  }
}
