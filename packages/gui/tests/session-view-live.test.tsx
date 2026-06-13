/* eslint-disable max-lines-per-function */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setKernelClient } from '../src/kernel';
import type { KernelClient } from '../src/kernel/client';
import { useSessionStore } from '../src/store/session-store';
import { useUiStore } from '../src/store/ui-store';
import { SessionView } from '../src/workspace/SessionView';

const initialSession = useSessionStore.getState();
const initialUi = useUiStore.getState();

function stubClient(overrides: Partial<KernelClient> = {}): KernelClient {
  return {
    listSessions: vi.fn(async () => []),
    createSession: vi.fn(async () => ({
      id: 'x',
      mode: 'chat' as const,
      title: 'New Chat',
      pinned: false,
      status: 'idle' as const,
      updatedAt: ''
    })),
    startTask: vi.fn(async () => undefined),
    approveGate: vi.fn(async () => undefined),
    onEvent: vi.fn(() => () => undefined),
    ...overrides
  };
}

beforeEach(() => {
  useSessionStore.setState(initialSession, true);
  useUiStore.setState(initialUi, true);
  setKernelClient(null);
});

afterEach(() => {
  cleanup();
});

describe('SessionView live', () => {
  it('pushes user input into the timeline before startTask for an existing session', () => {
    const client = stubClient();
    setKernelClient(client);
    useSessionStore.getState().setSessions([
      {
        id: 's1',
        mode: 'code',
        title: 'Fix updater',
        branch: 'fix/u',
        pinned: false,
        status: 'idle',
        updatedAt: ''
      }
    ]);

    render(<SessionView sessionId="s1" mode="code" />);
    const input = document.querySelector('textarea.input');
    expect(input).toBeTruthy();
    fireEvent.change(input as HTMLTextAreaElement, {
      target: { value: 'Ship it' }
    });
    fireEvent.click(document.querySelector('button.send') as HTMLButtonElement);
    expect(useSessionStore.getState().timelines['s1'][0]).toEqual({
      kind: 'user',
      text: 'Ship it'
    });
    expect(client.startTask).toHaveBeenCalledWith('s1', 'Ship it');
  });

  it('creates a session only after the first draft message is submitted', async () => {
    const client = stubClient({
      createSession: vi.fn(async () => ({
        id: 'draft-1',
        mode: 'chat' as const,
        title: 'New Chat',
        pinned: false,
        status: 'idle' as const,
        updatedAt: ''
      }))
    });
    setKernelClient(client);

    render(<SessionView mode="chat" />);
    expect(document.querySelector('.draft-stage')).toBeTruthy();
    expect(screen.getByText('开始一个对话')).toBeTruthy();

    const input = document.querySelector('textarea.input');
    fireEvent.change(input as HTMLTextAreaElement, {
      target: { value: 'Help me debug this' }
    });
    fireEvent.click(document.querySelector('button.send') as HTMLButtonElement);

    await waitFor(() => {
      expect(client.createSession).toHaveBeenCalledWith('chat');
    });
    expect(useSessionStore.getState().activeSessionId).toBe('draft-1');
    expect(useSessionStore.getState().sessions['draft-1']?.title).toBe('Help me debug this');
    expect(useSessionStore.getState().timelines['draft-1'][0]).toEqual({
      kind: 'user',
      text: 'Help me debug this'
    });
    expect(client.startTask).toHaveBeenCalledWith('draft-1', 'Help me debug this');
  });

  it('does not render the summary controls for a draft session with no real run state yet', () => {
    setKernelClient(stubClient());

    render(<SessionView mode="chat" />);

    expect(document.querySelector('.draft-stage')).toBeTruthy();
    expect(document.querySelector('.summary-panel')).toBeNull();
    expect(screen.queryByRole('button', { name: '切换摘要栏' })).toBeNull();
  });

  it('uses the compact draft layout when the right rail is open', () => {
    setKernelClient(stubClient());
    useUiStore.setState({ rightPanelOpen: true }, false);

    render(<SessionView mode="code" />);

    expect(document.querySelector('.draft-stage-compact')).toBeTruthy();
    expect(document.querySelector('#composer-project-select')).toBeTruthy();
  });

  it('hides the workspace selector for an existing code session', () => {
    setKernelClient(stubClient());
    useSessionStore.getState().setSessions([
      {
        id: 'existing-code-1',
        mode: 'code',
        title: 'Fix updater',
        branch: 'fix/u',
        pinned: false,
        status: 'idle',
        updatedAt: ''
      }
    ]);

    render(<SessionView sessionId="existing-code-1" mode="code" />);

    expect(document.querySelector('#composer-project-select')).toBeNull();
    expect(document.querySelector('.composer-context')).toBeNull();
  });

  it('shows an existing-session idle state instead of the new-session starter when a saved session has no timeline yet', () => {
    setKernelClient(stubClient());
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' }, true);
    useSessionStore.getState().setSessions([
      {
        id: 'idle-1',
        mode: 'code',
        title: 'Loop convergence follow-up',
        branch: 'loop/coverage',
        pinned: false,
        status: 'idle',
        updatedAt: ''
      }
    ]);

    render(<SessionView sessionId="idle-1" mode="code" />);

    expect(screen.queryByText('Start a code session')).toBeNull();
    expect(screen.getByText('This session is ready for the first task.')).toBeTruthy();
  });

  it('renders session-stage containers for the mockup layout and keeps the drawer closed by default', () => {
    setKernelClient(stubClient());
    useSessionStore.getState().setSessions([
      {
        id: 's1',
        mode: 'code',
        title: 'Fix updater',
        branch: 'fix/u',
        pinned: false,
        status: 'idle',
        updatedAt: ''
      }
    ]);

    render(<SessionView sessionId="s1" mode="code" />);

    expect(document.querySelector('.session-stage')).toBeTruthy();
    expect(document.querySelector('.ws-title-block')).toBeTruthy();
    expect(document.querySelector('.summary')).toBeTruthy();
    expect(document.querySelector('.summary')?.className).not.toContain('open');
    expect(document.querySelector('.summary')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.composer-wrap .costbar')).toBeTruthy();
  });

  it('opens a codex-like summary drawer for the seeded code-gate preview session', () => {
    setKernelClient(stubClient());
    useUiStore.setState({ rightPanelOpen: true }, false);
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

    render(<SessionView sessionId="code-gate" mode="code" />);
    fireEvent.click(screen.getByRole('button', { name: '切换摘要栏' }));

    expect(document.querySelector('.summary.open')).toBeTruthy();
    expect(document.querySelector('.summary-preview')).toBeTruthy();
    expect(document.querySelector('.summary-with-right-rail')).toBeTruthy();
    expect(document.querySelector('.summary-progress-list')).toBeTruthy();
    expect(document.querySelector('.stream.preview-stream')).toBeTruthy();
    expect(document.querySelector('.stream-rail-open')).toBeTruthy();
    expect(document.querySelector('.stream-summary-open')).toBeTruthy();
    expect(document.querySelector('.composer-wrap.preview-composer-wrap')).toBeTruthy();
    expect(document.querySelector('.stream .card.gate')).toBeTruthy();
    expect(document.querySelector('.stream .card.evid')).toBeTruthy();
    expect(screen.getByText('进度')).toBeTruthy();
    expect(screen.getByText(/证据 3/)).toBeTruthy();
  });

  it('shows subagents, browser, and sources sections only when the current session has those details', () => {
    setKernelClient(stubClient());
    useUiStore.setState({ rightPanelOpen: true, summaryOpen: true }, false);
    useSessionStore.getState().setSessions([
      {
        id: 'code-gate',
        mode: 'code',
        title: 'Fix updater signature failure',
        branch: 'fix/updater-sig',
        pinned: false,
        status: 'idle',
        updatedAt: '',
        agents: [{ name: 'Pasteur' }],
        browsers: [{ label: 'Bobby GUI 127.0.0.1:4173' }],
        sources: [{ label: 'docs/superpowers/specs/2026-06-13-bobby-gui-shell-mockup.html' }]
      }
    ]);

    render(<SessionView sessionId="code-gate" mode="code" />);

    expect(screen.getByText(/子智能体 1/)).toBeTruthy();
    expect(screen.getByText(/浏览器 1/)).toBeTruthy();
    expect(screen.getByText(/来源 1/)).toBeTruthy();
    expect(screen.queryByText('Pasteur')).toBeNull();
    expect(screen.queryByText('Bobby GUI 127.0.0.1:4173')).toBeNull();
    expect(screen.queryByText('docs/superpowers/specs/2026-06-13-bobby-gui-shell-mockup.html')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /子智能体 1/ }));
    expect(screen.getByText('Pasteur')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /浏览器 1/ }));
    expect(screen.getByText('Bobby GUI 127.0.0.1:4173')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /来源 1/ }));
    expect(screen.getByText('docs/superpowers/specs/2026-06-13-bobby-gui-shell-mockup.html')).toBeTruthy();
  });

  it('does not render empty summary detail sections for sessions without metadata', () => {
    setKernelClient(stubClient());
    useUiStore.setState({ summaryOpen: true }, false);
    useSessionStore.getState().setSessions([
      {
        id: 'plain-code-1',
        mode: 'code',
        title: 'Fix updater',
        branch: 'fix/u',
        pinned: false,
        status: 'idle',
        updatedAt: ''
      }
    ]);

    render(<SessionView sessionId="plain-code-1" mode="code" />);

    expect(screen.queryByText(/子智能体/)).toBeNull();
    expect(screen.queryByText(/浏览器/)).toBeNull();
    expect(screen.queryByText(/来源/)).toBeNull();
  });

  it('derives summary progress from verdict timeline items when a session has no explicit plan', () => {
    setKernelClient(stubClient());
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en', summaryOpen: true }, true);
    useSessionStore.getState().setSessions([
      {
        id: 'loop-1',
        mode: 'code',
        title: 'Loop convergence',
        branch: 'loop/coverage',
        pinned: false,
        status: 'done',
        updatedAt: ''
      }
    ]);
    useSessionStore.getState().applyGuiEvent({
      kind: 'kernel',
      sessionId: 'loop-1',
      event: {
        type: 'verdict',
        taskId: 't-loop-1',
        verdict: {
          claimId: 'c1',
          acId: 'cov',
          result: 'fail',
          oracleTier: 'T1',
          detail: 'Round 1: coverage 71% < 90%'
        }
      }
    });
    useSessionStore.getState().applyGuiEvent({
      kind: 'kernel',
      sessionId: 'loop-1',
      event: {
        type: 'verdict',
        taskId: 't-loop-1',
        verdict: {
          claimId: 'c1',
          acId: 'cov',
          result: 'pass',
          oracleTier: 'T1',
          detail: 'Round 2: coverage 92% >= 90%'
        }
      }
    });
    useSessionStore.getState().applyGuiEvent({
      kind: 'usage',
      sessionId: 'loop-1',
      usage: { inputTokens: 21000, outputTokens: 9800, cacheHitRate: 0.88, cny: 0.46 }
    });

    render(<SessionView sessionId="loop-1" mode="code" />);
    const summaryPanel = document.querySelector('.summary-panel');

    expect(screen.queryByText('No plan yet. This rail will show step convergence once work starts.')).toBeNull();
    expect(summaryPanel?.textContent).toContain('Round 1: coverage 71% < 90%');
    expect(summaryPanel?.textContent).toContain('Round 2: coverage 92% >= 90%');
    expect(summaryPanel?.textContent).toContain('¥0.46');
  });

  it('hydrates the loop fixture preview instead of falling back to the idle starter', () => {
    setKernelClient(stubClient());
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en', summaryOpen: true }, true);
    useSessionStore.getState().setSessions([
      {
        id: 'loop-converge',
        mode: 'code',
        title: 'Loop: coverage reaches 90%',
        branch: 'loop/coverage',
        pinned: false,
        status: 'idle',
        updatedAt: ''
      }
    ]);

    render(<SessionView sessionId="loop-converge" mode="code" />);
    const loopSummaryPanel = document.querySelector('.summary-panel');

    expect(screen.queryByText('This session is ready for the first task.')).toBeNull();
    expect(loopSummaryPanel?.textContent).toContain('Round 1: coverage 71% < 90%');
    expect(loopSummaryPanel?.textContent).toContain('Round 3: coverage 92% >= 90%, converged');
  });

  it('calls approveGate when the allow button is clicked', () => {
    const client = stubClient();
    setKernelClient(client);
    useSessionStore.getState().setSessions([
      { id: 's1', mode: 'code', title: 't', pinned: false, status: 'gate', updatedAt: '' }
    ]);
    useSessionStore.getState().applyGuiEvent({
      kind: 'kernel',
      sessionId: 's1',
      event: { type: 'gate_request', taskId: 't1', gateId: 'g9', reason: 'Need approval' }
    });

    render(<SessionView sessionId="s1" mode="code" />);
    const allowButton = document.querySelector('button.allow');
    expect(allowButton).toBeTruthy();
    fireEvent.click(allowButton as HTMLButtonElement);
    expect(client.approveGate).toHaveBeenCalledWith('s1', 'g9', 'allow');
  });

  it('shows usage values in the usage bar', () => {
    setKernelClient(stubClient());
    useSessionStore.getState().setSessions([
      { id: 's1', mode: 'chat', title: 't', pinned: false, status: 'idle', updatedAt: '' }
    ]);
    useSessionStore.getState().applyGuiEvent({
      kind: 'usage',
      sessionId: 's1',
      usage: { inputTokens: 8100, outputTokens: 4200, cacheHitRate: 0.92, cny: 0.18 }
    });

    render(<SessionView sessionId="s1" mode="chat" />);
    expect(screen.getByText(/92%/)).toBeTruthy();
  });
});
