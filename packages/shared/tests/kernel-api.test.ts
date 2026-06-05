import { describe, expect, it } from 'vitest';
import { KernelCommandSchema, KernelEventSchema } from '../src/api/kernel-api';

describe('Kernel API', () => {
  it('accepts a startTask command', () => {
    expect(() =>
      KernelCommandSchema.parse({ type: 'startTask', input: 'organize my downloads folder' })
    ).not.toThrow();
  });

  it('accepts a gate_request event', () => {
    const e = { type: 'gate_request', taskId: 't1', gateId: 'g1', reason: 'network access' };
    expect(() => KernelEventSchema.parse(e)).not.toThrow();
  });

  it('accepts a direct_answer event', () => {
    const e = { type: 'direct_answer', taskId: 't1', text: '你好，我可以帮你处理。' };
    expect(() => KernelEventSchema.parse(e)).not.toThrow();
  });

  it('rejects an unknown command type', () => {
    expect(() => KernelCommandSchema.parse({ type: 'nuke' })).toThrow();
  });
});
