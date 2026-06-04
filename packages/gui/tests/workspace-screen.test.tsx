import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { KernelEvent } from '@bobby/shared';
import type { Evidence } from '@bobby/shared';

import { EvidencePanel } from '../src/components/EvidencePanel';
import { Workspace } from '../src/screens/Workspace';

describe('workspace UI smoke', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders evidence file_exists as plain-language entry', () => {
    render(
      <EvidencePanel
        evidence={[
          {
            claimId: 'c1',
            acId: 'AC1',
            evidenceType: 'file_exists',
            payload: { exists: true, path: '/x/a.txt' },
            producedBy: 'tool'
          } satisfies Evidence
        ]}
      />
    );

    expect(screen.getByText(/文件已生成/)).toBeTruthy();
  });

  it('smoke renders workspace core areas', async () => {
    const onEvent = (callback: (event: KernelEvent) => void) => {
      void callback;
      return () => {};
    };
    const startTask = vi.fn().mockResolvedValue(undefined);
    const approveGate = vi.fn().mockResolvedValue(undefined);

    render(
      <Workspace
        kernelClient={{
          startTask,
          approveGate,
          onEvent
        }}
      />
    );

    expect(screen.getByText('对话')).toBeTruthy();
    expect(screen.getByText('计划')).toBeTruthy();
    expect(screen.getAllByText('证据').length).toBeGreaterThan(1);
    expect(screen.getByText(/成本用量/)).toBeTruthy();
    expect(screen.getByText(/切换到/)).toBeTruthy();
  });
});
