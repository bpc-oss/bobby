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

describe('SessionView static shell', () => {
  it('renders the title and summary toggle, then opens the summary drawer', () => {
    useSessionStore.getState().setSessions([{ id: 's1', mode: 'chat', title: '新对话', pinned: false, status: 'idle', updatedAt: '' }]);

    render(<SessionView sessionId="s1" mode="chat" />);

    expect(screen.getByText('新对话')).toBeTruthy();
    expect(document.querySelector('.summary')?.className).not.toContain('open');
    fireEvent.click(screen.getByRole('button', { name: '切换摘要栏' }));
    expect(useUiStore.getState().summaryOpen).toBe(true);
    expect(document.querySelector('.summary')?.className).toContain('open');
  });
});

describe('Composer', () => {
  it('submits input and clears the field', () => {
    const onSubmit = vi.fn();
    useUiStore.setState({ ...useUiStore.getState(), lang: 'zh' });
    render(<Composer mode="chat" onSubmit={onSubmit} />);
    const box = screen.getByPlaceholderText('询问或下达任务... @文件、/命令、粘贴图片');
    fireEvent.change(box, { target: { value: '修一个 sidebar bug' } });
    fireEvent.click(screen.getByRole('button', { name: '发送 ↗' }));
    expect(onSubmit).toHaveBeenCalledWith('修一个 sidebar bug');
    expect((box as HTMLTextAreaElement).value).toBe('');
  });

  it('shows workspace selection only in code mode', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'zh', currentProjectId: undefined });
    const { rerender } = render(<Composer mode="chat" onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText('工作区')).toBeNull();

    rerender(<Composer mode="code" onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('工作区'), { target: { value: 'bobby' } });
    expect(useUiStore.getState().currentProjectId).toBe('bobby');
    expect(screen.getByText('该项目下可创建多个 sessions')).toBeTruthy();
  });
});

describe('UsageBar', () => {
  it('shows non-zero usage text precisely', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'zh' });
    render(<UsageBar usage={{ inputTokens: 8100, outputTokens: 4200, cacheHitRate: 0.92, cny: 0.18 }} />);
    expect(screen.getByText('缓存 92%')).toBeTruthy();
    expect(screen.getByText('输入 8.1K / 输出 4.2K')).toBeTruthy();
    expect(screen.getByText('¥0.18')).toBeTruthy();
  });
});
