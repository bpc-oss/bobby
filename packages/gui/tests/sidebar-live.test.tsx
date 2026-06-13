/* eslint-disable max-lines-per-function */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Sidebar } from '../src/shell/Sidebar';
import { useSessionStore } from '../src/store/session-store';
import { useUiStore } from '../src/store/ui-store';

const initialUi = useUiStore.getState();
const initialSession = useSessionStore.getState();

beforeEach(() => {
  useUiStore.setState(initialUi, true);
  useSessionStore.setState(initialSession, true);
});

afterEach(() => {
  cleanup();
});

describe('Sidebar live list', () => {
  function isoOffsetFromNow(days: number): string {
    const value = new Date();
    value.setDate(value.getDate() + days);
    value.setHours(10, 0, 0, 0);
    return value.toISOString();
  }

  it('shows sessions for the active mode with pinned rows first', () => {
    useSessionStore.getState().setSessions([
      {
        id: 'a',
        mode: 'code',
        title: 'Fix updater',
        project: 'Bobby',
        pinned: true,
        status: 'gate',
        updatedAt: '2026-06-13T11:00:00Z'
      },
      {
        id: 'b',
        mode: 'code',
        title: 'Add tests',
        project: 'Bobby',
        pinned: false,
        status: 'done',
        updatedAt: '2026-06-13T03:00:00Z'
      },
      {
        id: 'c',
        mode: 'chat',
        title: 'Side thread',
        pinned: false,
        status: 'idle',
        updatedAt: '2026-06-13T01:00:00Z'
      }
    ]);
    useUiStore.setState({ ...useUiStore.getState(), mode: 'code', lang: 'en' });

    render(<Sidebar />);

    expect(screen.getByText('Fix updater')).toBeTruthy();
    expect(document.querySelector('.project-tree-list')).toBeTruthy();
    expect(screen.queryByText('Side thread')).toBeNull();
  });

  it('renders shell chrome markers for the mockup-style sidebar', () => {
    useSessionStore.getState().setSessions([
      {
        id: 'a',
        mode: 'chat',
        title: 'Review the mock layout',
        pinned: false,
        status: 'idle',
        updatedAt: '2026-06-13T10:00:00Z'
      }
    ]);

    render(<Sidebar />);

    expect(document.querySelector('.side-shell')).toBeTruthy();
    expect(document.querySelector('.side-list-shell')).toBeTruthy();
    expect(document.querySelector('.item-meta')).toBeTruthy();
  });

  it('hides untouched default-titled draft shells from the history list', () => {
    useSessionStore.getState().setSessions([
      {
        id: 'draft-empty',
        mode: 'chat',
        title: 'New Chat',
        pinned: false,
        status: 'idle',
        updatedAt: '2026-06-13T10:00:00Z'
      },
      {
        id: 'real-chat',
        mode: 'chat',
        title: 'Ship the sidebar cleanup',
        pinned: false,
        status: 'done',
        updatedAt: '2026-06-13T11:00:00Z'
      }
    ]);
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    render(<Sidebar />);

    expect(document.querySelector('.side-list')?.textContent).not.toContain('New Chat');
    expect(screen.getByText('Ship the sidebar cleanup')).toBeTruthy();
  });

  it('renders chat sessions in pinned, projects, and general sections with collapsible project groups', () => {
    useSessionStore.getState().setSessions([
      {
        id: 'pinned',
        mode: 'chat',
        title: 'Pinned note',
        pinned: true,
        status: 'idle',
        updatedAt: isoOffsetFromNow(-2)
      },
      {
        id: 'project-thread',
        mode: 'chat',
        title: 'Paper edits',
        project: 'long-form-writing',
        pinned: false,
        status: 'idle',
        updatedAt: isoOffsetFromNow(0)
      },
      {
        id: 'project-thread-2',
        mode: 'chat',
        title: 'Revision checklist',
        project: 'long-form-writing',
        pinned: false,
        status: 'idle',
        updatedAt: isoOffsetFromNow(-1)
      },
      {
        id: 'general-thread',
        mode: 'chat',
        title: 'Sidebar cleanup',
        pinned: false,
        status: 'idle',
        updatedAt: isoOffsetFromNow(0)
      },
    ]);
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    render(<Sidebar />);

    expect(screen.getByText('Pinned')).toBeTruthy();
    expect(screen.getAllByText('Projects').length).toBeGreaterThan(0);
    expect(screen.getByText('General')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Long-form writing 2/i })).toBeTruthy();
    expect(screen.queryByText('Paper edits')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Long-form writing 2/i }));

    expect(screen.getByText('Paper edits')).toBeTruthy();
    expect(screen.getByText('Revision checklist')).toBeTruthy();
    expect(screen.getByText('Sidebar cleanup')).toBeTruthy();
    expect(screen.queryByText('Today')).toBeNull();
    expect(screen.queryByText('Yesterday')).toBeNull();
    expect(screen.queryByText('UNSORTED')).toBeNull();
  });

  it('renders code sessions in pinned, projects, and global sections without a projects page', () => {
    useSessionStore.getState().setSessions([
      {
        id: 'p0',
        mode: 'code',
        title: 'GUI shell rebuild P0',
        pinned: true,
        status: 'running',
        updatedAt: '2026-06-13T16:00:00Z'
      },
      {
        id: 'bobby-1',
        mode: 'code',
        title: 'Fix updater signature',
        project: 'Bobby',
        pinned: false,
        status: 'gate',
        updatedAt: '2026-06-13T11:00:00Z'
      },
      {
        id: 'general-1',
        mode: 'code',
        title: 'Review shared CLI ergonomics',
        pinned: false,
        status: 'done',
        updatedAt: '2026-06-12T12:00:00Z'
      },
      {
        id: 'paper-1',
        mode: 'code',
        title: 'Citations cleanup',
        project: 'Paper tools',
        pinned: false,
        status: 'idle',
        updatedAt: '2026-06-11T09:00:00Z'
      }
    ]);
    useUiStore.setState({ ...useUiStore.getState(), mode: 'code', lang: 'en' });

    render(<Sidebar />);

    expect(screen.queryByText('Projects')).toBeTruthy();
    expect(screen.getByText('Pinned')).toBeTruthy();
    expect(screen.getByText('General')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Projects' })).toBeNull();
    expect(screen.getByText('Bobby')).toBeTruthy();
    expect(screen.getByText('Paper tools')).toBeTruthy();
    expect(screen.queryByText('APP develop team')).toBeNull();
  });

  it('expands a project row to show its child sessions', () => {
    useSessionStore.getState().setSessions([
      {
        id: 'bobby-1',
        mode: 'code',
        title: 'Fix updater signature',
        project: 'Bobby',
        pinned: false,
        status: 'gate',
        updatedAt: '2026-06-13T11:00:00Z'
      },
      {
        id: 'global-1',
        mode: 'code',
        title: 'Investigate shell spacing',
        pinned: false,
        status: 'done',
        updatedAt: '2026-06-13T08:00:00Z'
      }
    ]);
    useUiStore.setState({ ...useUiStore.getState(), mode: 'code', lang: 'en' });

    render(<Sidebar />);
    expect(screen.queryByText('Fix updater signature')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Bobby/i }));

    expect(screen.getByText('Fix updater signature')).toBeTruthy();
    expect(screen.getByText('Investigate shell spacing')).toBeTruthy();
  });

  it('groups code sessions under the canonical project even when fixture names use ids or casing variants', () => {
    useSessionStore.getState().setSessions([
      {
        id: 'bobby-1',
        mode: 'code',
        title: 'Normalize project mapping',
        project: 'bobby',
        pinned: false,
        status: 'done',
        updatedAt: '2026-06-13T09:00:00Z'
      }
    ]);
    useUiStore.setState({ ...useUiStore.getState(), mode: 'code', lang: 'en' });

    render(<Sidebar />);

    expect(screen.getByRole('button', { name: /Bobby 1/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Bobby 1/i }));
    expect(screen.getByText('Normalize project mapping')).toBeTruthy();
  });

  it('uses project rows as collapsible groups instead of a project entry card', () => {
    useSessionStore.getState().setSessions([
      {
        id: 'bobby-1',
        mode: 'code',
        title: 'Fix updater signature',
        project: 'Bobby',
        pinned: false,
        status: 'gate',
        updatedAt: '2026-06-13T11:00:00Z'
      }
    ]);
    useUiStore.setState({ ...useUiStore.getState(), mode: 'code', lang: 'en' });

    render(<Sidebar />);

    const projectButton = screen.getByRole('button', { name: /Bobby 1/i });
    expect(projectButton.textContent).not.toContain('E:/ai-files/Bobby');
    expect(screen.queryByText('Fix updater signature')).toBeNull();

    fireEvent.click(projectButton);

    expect(screen.getByText('Fix updater signature')).toBeTruthy();
  });

  it('marks the active session row with the shell selected state', () => {
    useSessionStore.getState().setSessions([
      { id: 'a', mode: 'code', title: 'Fix updater', pinned: false, status: 'idle', updatedAt: '' }
    ]);
    useUiStore.setState({ ...useUiStore.getState(), mode: 'code', lang: 'en' });

    render(<Sidebar />);
    fireEvent.click(screen.getByText('Fix updater'));

    expect(screen.getByText('Fix updater').closest('button')?.className).toContain('active');
  });

  it('clears the new session entry highlight after selecting a history thread', () => {
    useSessionStore.getState().setSessions([
      { id: 'a', mode: 'code', title: 'Fix updater', pinned: false, status: 'idle', updatedAt: '' }
    ]);
    useUiStore.setState({ ...useUiStore.getState(), mode: 'code', lang: 'zh', view: 'session' });

    render(<Sidebar />);

    const newSessionButton = screen.getByRole('button', { name: /新会话/i });
    expect(newSessionButton.className).toContain('active');

    fireEvent.click(screen.getByText('Fix updater'));

    expect(useSessionStore.getState().activeSessionId).toBe('a');
    expect(screen.getByText('Fix updater').closest('button')?.className).toContain('active');
    expect(newSessionButton.className).not.toContain('active');
  });

  it('mirrors kernel lifecycle into sidebar status dots', () => {
    useSessionStore.getState().setSessions([
      { id: 'a', mode: 'code', title: 'code-gate', pinned: false, status: 'idle', updatedAt: '' }
    ]);
    useUiStore.setState({ ...useUiStore.getState(), mode: 'code', lang: 'en' });

    render(<Sidebar />);

    const dotClass = () => screen.getByText('code-gate').closest('button')?.querySelector('.dot')?.className ?? '';
    expect(dotClass()).toContain('none');

    act(() => {
      useSessionStore.getState().addUserMessage('a', 'start');
    });
    expect(dotClass()).toContain('run');

    act(() => {
      useSessionStore.getState().applyGuiEvent({
        kind: 'kernel',
        sessionId: 'a',
        event: { type: 'gate_request', taskId: 't1', gateId: 'g1', reason: 'need approval' }
      });
    });
    expect(dotClass()).toContain('gate');

    act(() => {
      useSessionStore.getState().applyGuiEvent({
        kind: 'kernel',
        sessionId: 'a',
        event: { type: 'final_result', taskId: 't1', status: 'failed' }
      });
    });
    expect(dotClass()).toContain('err');
  });
});
