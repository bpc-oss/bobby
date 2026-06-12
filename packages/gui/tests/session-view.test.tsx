import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionStore } from '../src/store/session-store';
import { useUiStore } from '../src/store/ui-store';
import { Composer } from '../src/workspace/Composer';
import { SessionView } from '../src/workspace/SessionView';
import { UsageBar } from '../src/workspace/UsageBar';

const initialUi = useUiStore.getState();
const initialSession = useSessionStore.getState();

beforeEach(() => {
  useUiStore.setState(initialUi, true);
  useSessionStore.setState(initialSession, true);
});

afterEach(() => {
  cleanup();
});

describe('SessionView 静态壳', () => {
  it('渲染标题与摘要开关，点击展开摘要', () => {
    useSessionStore.getState().setSessions([
      { id: 's1', mode: 'chat', title: 'New Chat', pinned: false, status: 'idle', updatedAt: '' }
    ]);
    render(<SessionView sessionId="s1" />);
    expect(screen.getByText('New Chat')).toBeTruthy();
    fireEvent.click(screen.getByText(/摘要/));
    expect(useUiStore.getState().summaryOpen).toBe(true);
  });
});

describe('Composer', () => {
  it('输入并发送触发 onSubmit，输入框清空', () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} />);
    const box = screen.getByPlaceholderText(/询问或下达任务/);
    fireEvent.change(box, { target: { value: '帮我修个 bug' } });
    fireEvent.click(screen.getByText(/发送/));
    expect(onSubmit).toHaveBeenCalledWith('帮我修个 bug');
    expect((box as HTMLTextAreaElement).value).toBe('');
  });

  it('空输入不触发 onSubmit', () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText(/发送/));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('UsageBar', () => {
  it('显示精确的非零用量文案', () => {
    render(
      <UsageBar usage={{ inputTokens: 8100, outputTokens: 4200, cacheHitRate: 0.92, cny: 0.18 }} />
    );
    expect(screen.getByText('CACHE 92% · IN 8.1K / OUT 4.2K · ¥0.18')).toBeTruthy();
  });

  it('零态显示精确的 directive 文案', () => {
    render(<UsageBar usage={{ inputTokens: 0, outputTokens: 0, cacheHitRate: -1, cny: 0 }} />);
    expect(screen.getByText('CACHE — · 0 TOK · ¥0.00')).toBeTruthy();
  });
});
