import React from 'react';
import { expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import { App } from '../src/ui/App';
import { initialVM, type VM } from '../src/ui/view-model';

const delay = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

it('renders lines from vm.lines', () => {
  const vm: VM = {
    ...initialVM(),
    lines: ['first line', 'second line'],
    status: 'running'
  };

  const { lastFrame } = render(<App vm={vm} onSubmit={() => {}} onGate={() => {}} />);
  const frame = lastFrame();

  expect(frame).toContain('first line');
  expect(frame).toContain('second line');
});

it('shows gate reason when pendingGate exists', () => {
  const vm: VM = {
    ...initialVM(),
    pendingGate: { gateId: 'g1', reason: 'requires external permission' }
  };

  const { lastFrame } = render(<App vm={vm} onSubmit={() => {}} onGate={() => {}} />);
  const frame = lastFrame();

  expect(frame).toContain('requires external permission');
  expect(frame).toContain('[y/n]');
});

it('calls onGate("allow") when pressing y', () => {
  const onGate = vi.fn();
  const vm: VM = {
    ...initialVM(),
    pendingGate: { gateId: 'g1', reason: 'approve this action' }
  };
  const { stdin } = render(<App vm={vm} onSubmit={() => {}} onGate={onGate} />);

  return delay().then(() => {
    stdin.write('y');
    expect(onGate).toHaveBeenCalledWith('allow');
  });
});

it('calls onGate("deny") when pressing n', () => {
  const onGate = vi.fn();
  const vm: VM = {
    ...initialVM(),
    pendingGate: { gateId: 'g1', reason: 'approve this action' }
  };
  const { stdin } = render(<App vm={vm} onSubmit={() => {}} onGate={onGate} />);

  return delay().then(() => {
    stdin.write('n');
    expect(onGate).toHaveBeenCalledWith('deny');
  });
});

it('submits newline when return is pressed with no pending gate', () => {
  const onSubmit = vi.fn();
  const vm: VM = {
    ...initialVM(),
    status: 'running',
    lines: []
  };
  const { stdin } = render(<App vm={vm} onSubmit={onSubmit} onGate={() => {}} />);

  return delay().then(() => {
    stdin.write('\r');
    expect(onSubmit).toHaveBeenCalledWith('\n');
  });
});
