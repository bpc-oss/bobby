import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { Evidence, KernelEvent } from '@bobby/shared';

import { EvidencePanel } from '../src/components/EvidencePanel';
import { Workspace } from '../src/screens/Workspace';

type KernelClientMock = {
  startTask: ReturnType<typeof vi.fn>;
  approveGate: ReturnType<typeof vi.fn>;
  onEvent: (callback: (event: KernelEvent) => void) => () => void;
};

function noopOnEvent(callback: (event: KernelEvent) => void): () => void {
  void callback;
  return () => {};
}

function makeKernelClientMock(): KernelClientMock {
  return {
    startTask: vi.fn().mockResolvedValue(undefined),
    approveGate: vi.fn().mockResolvedValue(undefined),
    onEvent: noopOnEvent
  };
}

function expectEvidenceFileExistsPlainLanguageEntry(): void {
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

  expect(screen.getByText('path: /x/a.txt')).toBeTruthy();
}

function expectWorkspaceCoreAreasToRender(): void {
  const client = makeKernelClientMock();
  const { container } = render(<Workspace kernelClient={client} />);

  expect(container.querySelector('#bobby-chat-input')).toBeTruthy();
  expect(container.querySelector('.workspace-grid')).toBeTruthy();
  expect(container.querySelector('.workspace-footer')).toBeTruthy();
}

function expectAlwaysDecisionToReachKernelClient(): void {
  const client = makeKernelClientMock();

  render(
    <Workspace
      initialState={{
        steps: [],
        evidence: [],
        status: 'running',
        pendingGate: {
          gateId: 'gate-always',
          reason: 'net-access'
        }
      }}
      kernelClient={client}
    />
  );

  const alwaysButton = screen.getByRole('button', { name: 'Always' });
  fireEvent.click(alwaysButton);

  expect(client.approveGate).toHaveBeenCalledWith('gate-always', 'always');
}

describe('workspace UI smoke', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders evidence file_exists as plain-language entry', expectEvidenceFileExistsPlainLanguageEntry);
  it('smoke renders workspace core areas', expectWorkspaceCoreAreasToRender);
  it('sends always decision to kernel client when gate is confirmed', expectAlwaysDecisionToReachKernelClient);
});
