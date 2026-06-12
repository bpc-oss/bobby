/* eslint-disable max-lines-per-function */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '../src/store/session-store';
import { useUiStore } from '../src/store/ui-store';
import { Sidebar } from '../src/shell/Sidebar';

const initialUi = useUiStore.getState();
const initialSession = useSessionStore.getState();

beforeEach(() => {
  useUiStore.setState(initialUi, true);
  useSessionStore.setState(initialSession, true);
});

afterEach(() => {
  cleanup();
});

describe('Sidebar（live 列表）', () => {
  it('按模式显示 store 里的会话，置顶分组在前，状态点映射 status', () => {
    useSessionStore.getState().setSessions([
      {
        id: 'a',
        mode: 'code',
        title: '修复 updater',
        project: 'bobby',
        pinned: true,
        status: 'gate',
        updatedAt: '2026-06-13T11:00:00Z'
      },
      {
        id: 'b',
        mode: 'code',
        title: '单测补全',
        project: 'bobby',
        pinned: false,
        status: 'done',
        updatedAt: '2026-06-13T03:00:00Z'
      },
      {
        id: 'c',
        mode: 'chat',
        title: '闲聊',
        pinned: false,
        status: 'idle',
        updatedAt: '2026-06-13T01:00:00Z'
      }
    ]);
    useUiStore.getState().setMode('code');

    render(<Sidebar />);

    expect(screen.getByText('修复 updater')).toBeTruthy();
    expect(screen.getByText('单测补全')).toBeTruthy();
    expect(screen.queryByText('闲聊')).toBeNull();
  });

  it('点击会话条目设为 activeSession 并切到 session 视图', () => {
    useSessionStore.getState().setSessions([
      { id: 'a', mode: 'chat', title: '闲聊', pinned: false, status: 'idle', updatedAt: '' }
    ]);
    useUiStore.getState().setView('projects');

    render(<Sidebar />);
    fireEvent.click(screen.getByText('闲聊'));

    expect(useSessionStore.getState().activeSessionId).toBe('a');
    expect(useUiStore.getState().view).toBe('session');
  });

  it('kernel lifecycle mirrors into sidebar status dots', () => {
    useSessionStore.getState().setSessions([
      { id: 'a', mode: 'code', title: 'code-gate', pinned: false, status: 'idle', updatedAt: '' }
    ]);
    useUiStore.getState().setMode('code');
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
