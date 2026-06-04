import { describe, expect, it } from 'vitest';
import { Kernel } from '../src/kernel';

describe('Kernel', () => {
  it('starts and stops with correct state', async () => {
    const k = new Kernel();
    expect(k.isRunning).toBe(false);
    await k.start();
    expect(k.isRunning).toBe(true);
    await k.stop();
    expect(k.isRunning).toBe(false);
  });

  it('delivers published events to subscribers', async () => {
    const k = new Kernel();
    await k.start();
    const seen: string[] = [];
    k.on((e) => seen.push(e.type));
    k.emit({ type: 'error', taskId: 't1', message: 'boom' });
    expect(seen).toEqual(['error']);
    await k.stop();
  });

  it('rejects publishing events before start', () => {
    const k = new Kernel();
    expect(() => k.emit({ type: 'error', taskId: 't1', message: 'x' })).toThrow();
  });

  it('rejects invalid published events after start', async () => {
    const k = new Kernel();
    await k.start();
    expect(() =>
      k.emit({ type: 'final_result', taskId: 't1', status: 'done_without_validation' } as never)
    ).toThrow();
  });
});
