/* eslint-disable max-lines-per-function */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../src/store/ui-store';
import { TimelineCard } from '../src/workspace/TimelineCards';

const initialUi = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initialUi, true);
});

afterEach(() => {
  cleanup();
});

describe('TimelineCard', () => {
  it('renders user messages as right-side bubbles', () => {
    render(<TimelineCard item={{ kind: 'user', text: '你好' }} onGateDecision={vi.fn()} />);
    expect(screen.getByText('你好').className).toContain('user');
  });

  it('renders gate_request approval cards and calls allow', () => {
    const onDecide = vi.fn();

    render(
      <TimelineCard
        item={{
          kind: 'kernel',
          event: { type: 'gate_request', taskId: 't1', gateId: 'g1', reason: '要执行打包命令' }
        }}
        onGateDecision={onDecide}
        gatePending
      />
    );

    expect(screen.getByText(/要执行打包命令/)).toBeTruthy();
    fireEvent.click(screen.getByText('允许'));
    expect(onDecide).toHaveBeenCalledWith('g1', 'allow');
  });

  it('hides buttons after a gate has already been decided', () => {
    render(
      <TimelineCard
        item={{
          kind: 'kernel',
          event: { type: 'gate_request', taskId: 't1', gateId: 'g1', reason: 'x' }
        }}
        onGateDecision={vi.fn()}
        gatePending={false}
      />
    );

    expect(screen.queryByText('允许')).toBeNull();
    expect(screen.getByText(/已决策/)).toBeTruthy();
  });

  it('renders evidence cards with the evidence type and payload summary', () => {
    render(
      <TimelineCard
        item={{
          kind: 'kernel',
          event: {
            type: 'evidence_produced',
            taskId: 't1',
            evidence: {
              claimId: 'c1',
              acId: 'a1',
              evidenceType: 'command_output',
              payload: { stdout: '✓ built in 42.3s' },
              producedBy: 'tool'
            }
          }
        }}
        onGateDecision={vi.fn()}
      />
    );

    expect(screen.getByText(/command_output/)).toBeTruthy();
    expect(screen.getByText(/built in 42.3s/)).toBeTruthy();
  });

  it('renders verdict cards', () => {
    render(
      <TimelineCard
        item={{
          kind: 'kernel',
          event: {
            type: 'verdict',
            taskId: 't1',
            verdict: {
              claimId: 'c1',
              acId: 'a1',
              result: 'pass',
              oracleTier: 'T2',
              detail: 'Pro 复核通过'
            }
          }
        }}
        onGateDecision={vi.fn()}
      />
    );

    expect(screen.getByText(/Pro 复核通过/)).toBeTruthy();
  });
});
