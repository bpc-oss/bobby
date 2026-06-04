import { KernelEvent, KernelEventSchema } from '@bobby/shared';

type Listener = (event: KernelEvent) => void;

export class Kernel {
  private running = false;
  private readonly listeners = new Set<Listener>();

  get isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
    this.listeners.clear();
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: KernelEvent): void {
    if (!this.running) {
      throw new Error('Kernel not running');
    }

    const parsed = KernelEventSchema.parse(event);
    for (const listener of this.listeners) {
      listener(parsed);
    }
  }
}
