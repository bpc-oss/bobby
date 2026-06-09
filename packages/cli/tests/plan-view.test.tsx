import React from 'react';
import { expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import type { PlanStep } from '@bobby/shared';
import { PlanView } from '../src/ui/PlanView';

type KeyCallback = Parameters<typeof import('ink')['useInput']>[0];

let capturedUseInput: KeyCallback | null = null;

vi.mock('ink', async () => {
  const actual = await vi.importActual<typeof import('ink')>('ink');
  return {
    ...actual,
    useInput: (callback: KeyCallback) => {
      capturedUseInput = callback;
    }
  };
});

const steps: PlanStep[] = [
  {
    id: 'S1',
    desc: 'Initialize repository',
    satisfiesAcIds: ['AC1'],
    dependsOn: []
  },
  {
    id: 'S2',
    desc: 'Run baseline tests',
    satisfiesAcIds: ['AC2'],
    dependsOn: ['S1']
  }
];

it('renders plan step details for all fields', () => {
  const { lastFrame } = render(<PlanView steps={steps} onDecision={() => {}} />);
  const frame = lastFrame() ?? '';

  expect(frame).toContain('Plan');
  expect(frame).toContain('S1');
  expect(frame).toContain('Initialize repository');
  expect(frame).toContain('S1: Initialize repository');
  expect(frame).not.toContain('dependsOn:');
  expect(frame).not.toContain('depends on (none)');
  expect(frame).not.toContain('satisfiesAcIds:');
  expect(frame).not.toContain('AC1');

  expect(frame).toContain('S2');
  expect(frame).toContain('Run baseline tests');
  expect(frame).toContain('S2: Run baseline tests');
  expect(frame).not.toContain('dependsOn:');
  expect(frame).not.toContain('satisfiesAcIds: AC2');
  expect(frame).toContain('depends on S1');
  expect(frame).not.toContain('AC2');
});

it('displays approve/edit/reject actions', () => {
  const { lastFrame } = render(<PlanView steps={steps} onDecision={() => {}} />);
  const frame = lastFrame() ?? '';

  expect(frame).toContain('[a] approve');
  expect(frame).toContain('[e] edit');
  expect(frame).toContain('[r] reject');
});

it('fires onDecision with approve when user presses a', () => {
  const onDecision = vi.fn();
  capturedUseInput = null;
  render(<PlanView steps={steps} onDecision={onDecision} />);
  if (!capturedUseInput) {
    throw new Error('useInput callback was not captured');
  }

  const callback = capturedUseInput as KeyCallback;
  callback('a', { return: false } as Parameters<KeyCallback>[1]);

  expect(onDecision).toHaveBeenCalledWith('approve');
});

it('fires onDecision with edit when user presses e', () => {
  const onDecision = vi.fn();
  capturedUseInput = null;
  render(<PlanView steps={steps} onDecision={onDecision} />);
  if (!capturedUseInput) {
    throw new Error('useInput callback was not captured');
  }

  const callback = capturedUseInput as KeyCallback;
  callback('e', { return: false } as Parameters<KeyCallback>[1]);

  expect(onDecision).toHaveBeenCalledWith('edit');
});

it('fires onDecision with reject when user presses r', () => {
  const onDecision = vi.fn();
  capturedUseInput = null;
  render(<PlanView steps={steps} onDecision={onDecision} />);
  if (!capturedUseInput) {
    throw new Error('useInput callback was not captured');
  }
  const callback = capturedUseInput as KeyCallback;
  callback('r', { return: false } as Parameters<KeyCallback>[1]);
  expect(onDecision).toHaveBeenCalledWith('reject');
});
