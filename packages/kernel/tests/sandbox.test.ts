import { expect, it } from 'vitest';

import { resolveSandbox, type SandboxConfig } from '../src/hands/sandbox';

it('returns lightweight when disabled without probing container runtime', () => {
  const cfg: SandboxConfig = { enabled: false };
  let called = false;
  const hasContainerRuntime = () => {
    called = true;
    return true;
  };

  const plan = resolveSandbox(cfg, hasContainerRuntime);

  expect(plan).toMatchObject({ mode: 'lightweight' });
  expect(called).toBe(false);
});

it('returns strong when enabled and container runtime exists', () => {
  const cfg: SandboxConfig = { enabled: true };
  const hasContainerRuntime = () => true;

  const plan = resolveSandbox(cfg, hasContainerRuntime);

  expect(plan).toMatchObject({ mode: 'strong' });
});

it('throws when strong sandbox is enabled but runtime is missing', () => {
  const cfg: SandboxConfig = { enabled: true };
  const hasContainerRuntime = () => false;

  expect(() => resolveSandbox(cfg, hasContainerRuntime)).toThrow(/container runtime/i);
});
