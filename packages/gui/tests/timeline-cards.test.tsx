/* eslint-disable max-lines-per-function */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TimelineCard } from '../src/workspace/TimelineCards';

afterEach(() => {
  cleanup();
});

describe('TimelineCard', () => {
  it('用户消息右侧气泡', () => {
    render(<TimelineCard item={{ kind: 'user', text: '你好' }} onGateDecision={vi.fn()} />);
    expect(screen.getByText('你好').className).toContain('user');
  });

  it('gate_request 渲染审批卡，点允许回调 allow', () => {
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

  it('已决策的 gate 卡不再显示按钮', () => {
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
  });

  it('evidence_produced 渲染证据卡（类型 + payload 摘要）', () => {
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

  it('verdict 渲染复核卡', () => {
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
