import { expect, it } from 'vitest';

import { classifyAction, requiresGate, type Action, type Tier } from '../src/hands/permission';

it('workspace read is L0 and does not require gate', () => {
  const action: Action = { kind: 'read', insideWorkspace: true };
  const tier: Tier = classifyAction(action);
  expect(tier).toBe('L0');
  expect(requiresGate(tier)).toBe(false);
});

it('workspace write is L1 and does not require gate', () => {
  const action: Action = { kind: 'write', insideWorkspace: true };
  const tier: Tier = classifyAction(action);
  expect(tier).toBe('L1');
  expect(requiresGate(tier)).toBe(false);
});

it('exec is L2 and does not require gate', () => {
  const action: Action = { kind: 'exec' };
  const tier: Tier = classifyAction(action);
  expect(tier).toBe('L2');
  expect(requiresGate(tier)).toBe(false);
});

it('outside workspace write is L3 and requires gate', () => {
  const action: Action = { kind: 'write', insideWorkspace: false };
  const tier: Tier = classifyAction(action);
  expect(tier).toBe('L3');
  expect(requiresGate(tier)).toBe(true);
});

it('delete is L3 and requires gate', () => {
  const action: Action = { kind: 'delete' };
  const tier: Tier = classifyAction(action);
  expect(tier).toBe('L3');
  expect(requiresGate(tier)).toBe(true);
});

it('install is L3 and requires gate', () => {
  const action: Action = { kind: 'install' };
  const tier: Tier = classifyAction(action);
  expect(tier).toBe('L3');
  expect(requiresGate(tier)).toBe(true);
});

it('network is L4 and requires gate', () => {
  const action: Action = { kind: 'network' };
  const tier: Tier = classifyAction(action);
  expect(tier).toBe('L4');
  expect(requiresGate(tier)).toBe(true);
});

it('global is L4 and requires gate', () => {
  const action: Action = { kind: 'global' };
  const tier: Tier = classifyAction(action);
  expect(tier).toBe('L4');
  expect(requiresGate(tier)).toBe(true);
});

it('outside workspace read is L4 and requires gate', () => {
  const action: Action = { kind: 'read', insideWorkspace: false };
  const tier: Tier = classifyAction(action);
  expect(tier).toBe('L4');
  expect(requiresGate(tier)).toBe(true);
});
