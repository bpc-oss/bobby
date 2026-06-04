import type { KernelEvent } from '@bobby/shared';

export class TraceStore {
  private readonly events = new Map<string, KernelEvent[]>();

  append(taskId: string, event: KernelEvent): void {
    const current = this.events.get(taskId) ?? [];
    current.push(event);
    this.events.set(taskId, current);
  }

  get(taskId: string): readonly KernelEvent[] {
    return Object.freeze([...(this.events.get(taskId) ?? [])]);
  }
}
