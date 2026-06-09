import React from 'react';
import { expect, it } from 'vitest';
import { render } from 'ink-testing-library';

import { StatusLine } from '../src/ui/StatusLine';
import { initialVM } from '../src/ui/view-model';

it('renders running state with cost metrics', () => {
  const { lastFrame } = render(
    <StatusLine
      vm={{
        ...initialVM(),
        status: 'running',
        spentUsd: 12.345
      }}
    />
  );

  const frame = lastFrame();
  expect(frame).toContain('◉ running');
  expect(frame).toContain('$12.35');
});

it('renders done status', () => {
  const { lastFrame } = render(
    <StatusLine
      vm={{
        ...initialVM(),
        status: 'done',
        spentUsd: 0
      }}
    />
  );

  const frame = lastFrame();
  expect(frame).toContain('✓ done');
  expect(frame).toContain('$0.00');
});

it('renders failed status', () => {
  const { lastFrame } = render(
    <StatusLine
      vm={{
        ...initialVM(),
        status: 'failed',
        spentUsd: 3.1
      }}
    />
  );

  const frame = lastFrame();
  expect(frame).toContain('✗ failed');
  expect(frame).toContain('$3.10');
});

it('renders blocked status', () => {
  const { lastFrame } = render(
    <StatusLine
      vm={{
        ...initialVM(),
        status: 'blocked',
        spentUsd: 0.5
      }}
    />
  );

  const frame = lastFrame();
  expect(frame).toContain('⊘ blocked');
  expect(frame).toContain('$0.50');
});

it('renders explicit idle status', () => {
  const { lastFrame } = render(
    <StatusLine
      vm={{
        ...initialVM(),
        status: 'idle'
      }}
    />
  );

  const frame = lastFrame();
  expect(frame).toContain('○ idle');
  expect(frame).not.toContain('undefined');
});

it('renders model name and omits undefined values', () => {
  const { lastFrame } = render(
    <StatusLine
      vm={{
        ...initialVM(),
        usageModel: 'deepseek-v3',
        costUsd: 0.0034
      }}
    />
  );

  const frame = lastFrame();
  expect(frame).toContain('deepseek-v3');
  expect(frame).toContain('$0.0034');
  expect(frame).not.toContain('undefined');
});
