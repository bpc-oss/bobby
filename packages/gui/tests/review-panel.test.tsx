import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ReviewPanel } from '../src/panels/ReviewPanel';
import { useSessionStore } from '../src/store/session-store';
import { useUiStore } from '../src/store/ui-store';

const initialSession = useSessionStore.getState();
const initialUi = useUiStore.getState();

function seedCodeGatePreview(): void {
  useSessionStore.getState().setActiveSession('code-gate');
  useSessionStore.getState().setSessions([
    {
      id: 'code-gate',
      mode: 'code',
      title: 'Fix updater signature failure',
      branch: 'fix/updater-sig',
      pinned: false,
      status: 'idle',
      updatedAt: ''
    }
  ]);
}

function seedEvidenceTimeline(): void {
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
}

beforeEach(() => {
  useSessionStore.setState(initialSession, true);
  useUiStore.setState(initialUi, true);
});

afterEach(() => {
  cleanup();
});

describe('ReviewPanel', () => {
  it('extracts file diffs from the timeline and lists all evidence', () => {
    seedEvidenceTimeline();

    render(<ReviewPanel />);

    expect(screen.getAllByText(/electron-builder\.yml/).length).toBeGreaterThan(0);
    expect(screen.getByText(/^变更 · 1$/)).toBeTruthy();
    expect(screen.getByText(/^证据 · 2$/)).toBeTruthy();
    expect(document.querySelector('.diff')).toBeTruthy();
  });

  it('renders the mockup-style empty state when no session evidence exists', () => {
    render(<ReviewPanel />);
    expect(document.querySelector('.rp-empty-state')).toBeTruthy();
    expect(screen.getByText(/暂无审查内容/)).toBeTruthy();
  });

  it('renders preview review content and the review toolbar for the seeded code-gate session', () => {
    seedCodeGatePreview();

    render(<ReviewPanel />);

    expect(screen.getByText(/变更 · 2/)).toBeTruthy();
    expect(screen.getByText(/packages\/gui\/electron-builder\.yml/)).toBeTruthy();
    expect(screen.getByText(/packages\/gui\/scripts\/verify-sig\.mjs/)).toBeTruthy();
    expect(document.querySelector('.diff')).toBeTruthy();
    expect(screen.getByText(/command_output/)).toBeTruthy();
    expect(screen.getByDisplayValue(/筛选文件/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /提交或推送/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /创建拉取请求/ })).toBeTruthy();
    expect(document.querySelector('.review-toolbar')).toBeTruthy();
  });
});
