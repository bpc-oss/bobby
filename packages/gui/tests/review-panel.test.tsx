import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ReviewPanel } from '../src/panels/ReviewPanel';
import { useSessionStore } from '../src/store/session-store';

const initial = useSessionStore.getState();

beforeEach(() => {
  useSessionStore.setState(initial, true);
});

afterEach(() => {
  cleanup();
});

describe('ReviewPanel', () => {
  it('从 timeline 提取 file_diff 变更，并列出全部证据', () => {
    const apply = useSessionStore.getState().applyGuiEvent;
    useSessionStore.getState().setActiveSession('s1');
    apply({
      kind: 'kernel',
      sessionId: 's1',
      event: {
        type: 'evidence_produced',
        taskId: 't1',
        evidence: {
          claimId: 'c1',
          acId: 'a1',
          evidenceType: 'file_diff',
          payload: { path: 'packages/gui/electron-builder.yml', plus: 3, minus: 1, diff: '+x' },
          producedBy: 'tool'
        }
      }
    });
    apply({
      kind: 'kernel',
      sessionId: 's1',
      event: {
        type: 'evidence_produced',
        taskId: 't1',
        evidence: {
          claimId: 'c1',
          acId: 'a2',
          evidenceType: 'command_output',
          payload: { stdout: 'ok' },
          producedBy: 'tool'
        }
      }
    });

    render(<ReviewPanel />);

    expect(screen.getByText(/electron-builder\.yml/)).toBeTruthy();
    expect(screen.getByText(/CHANGES · 1/)).toBeTruthy();
    expect(screen.getByText(/EVIDENCE · 2/)).toBeTruthy();
  });

  it('无活动会话时显示空状态', () => {
    render(<ReviewPanel />);
    expect(screen.getByText(/暂无变更与证据/)).toBeTruthy();
  });
});
