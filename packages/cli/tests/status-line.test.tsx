import React from 'react';
import { expect, it } from 'vitest';
import { render } from 'ink-testing-library';

import { StatusLine } from '../src/ui/StatusLine';
import { initialVM } from '../src/ui/view-model';

it('renders running state with spinner, activity, and stable cost metrics', () => {
  const { lastFrame } = render(
    <StatusLine
      vm={{
        ...initialVM(),
        status: 'running',
        spentUsd: 12.345,
        proCalls: 2,
        flashCalls: 1,
        contextPercent: 57.8,
        currentActivity: 'thinking'
      }}
    />
  );

  const frame = lastFrame();
  expect(frame).toContain('status: running');
  expect(frame).toContain('stream: event');
  expect(frame).toContain('spinner: *');
  expect(frame).toContain('activity: thinking');
  expect(frame).toContain('spentUsd: $12.35');
  expect(frame).toContain('proCalls: 2');
  expect(frame).toContain('flashCalls: 1');
  expect(frame).toContain('contextPercent: 57.80%');
});

it('renders done status as done and hides running marker', () => {
  const { lastFrame } = render(
    <StatusLine
      vm={{
        ...initialVM(),
        status: 'done',
        currentActivity: 'tool:test',
        spentUsd: 0,
        proCalls: 0,
        flashCalls: 0,
        contextPercent: 0
      }}
    />
  );

  const frame = lastFrame();
  expect(frame).toContain('status: done');
  expect(frame).not.toContain('spinner: *');
  expect(frame).toContain('activity: tool:test');
  expect(frame).toContain('spentUsd: $0.00');
});

it('renders failed status as failed and hides running marker', () => {
  const { lastFrame } = render(
    <StatusLine
      vm={{
        ...initialVM(),
        status: 'failed',
        currentActivity: 'tool:error',
        spentUsd: 3.1,
        proCalls: 0,
        flashCalls: 0,
        contextPercent: 0
      }}
    />
  );

  const frame = lastFrame();
  expect(frame).toContain('status: failed');
  expect(frame).not.toContain('spinner: *');
  expect(frame).toContain('activity: tool:error');
  expect(frame).toContain('spentUsd: $3.10');
});

it('renders blocked status as blocked and hides running marker', () => {
  const { lastFrame } = render(
    <StatusLine
      vm={{
        ...initialVM(),
        status: 'blocked',
        currentActivity: 'pause:approval',
        spentUsd: 0.5,
        proCalls: 0,
        flashCalls: 0,
        contextPercent: 0
      }}
    />
  );

  const frame = lastFrame();
  expect(frame).toContain('status: blocked');
  expect(frame).not.toContain('spinner: *');
  expect(frame).toContain('activity: pause:approval');
  expect(frame).toContain('spentUsd: $0.50');
});

it('renders explicit idle status without spinner', () => {
  const { lastFrame } = render(
    <StatusLine
      vm={{
        ...initialVM(),
        status: 'idle'
      }}
    />
  );

  const frame = lastFrame();
  expect(frame).toContain('status: idle');
  expect(frame).toContain('stream: event');
  expect(frame).not.toContain('spinner: *');
  expect(frame).not.toContain('false');
  expect(frame).not.toContain('undefined');
});

it('renders usage telemetry fields from vm usage state and omits undefined values', () => {
  const { lastFrame } = render(
    <StatusLine
      vm={{
        ...initialVM(),
        usageModel: 'deepseek-v3',
        promptTokens: 12,
        completionTokens: 4,
        cachedTokens: 2,
        costUsd: 0.0034
      }}
    />
  );

  const frame = lastFrame();
  expect(frame).toContain('model=deepseek-v3');
  expect(frame).toContain('prompt=12');
  expect(frame).toContain('completion=4');
  expect(frame).toContain('cached=2');
  expect(frame).toContain('cost=$0.0034');
  expect(frame).not.toContain('undefined');
});
