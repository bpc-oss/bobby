import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppShell } from '../src/shell/AppShell';
import { useUiStore } from '../src/store/ui-store';

const initial = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initial, true);
});

afterEach(() => {
  cleanup();
});

describe('AppShell', () => {
  it('默认渲染 chat 模式 + 静态会话壳', () => {
    render(<AppShell />);
    expect(screen.getByText('BOBBY')).toBeTruthy();
    expect(screen.getAllByText('New Chat')).toHaveLength(2);
    expect(screen.getByText(/MOCK MODE/)).toBeTruthy();
  });

  it('切到 code 模式点 Loop 显示向导骨架占位页', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole('tab', { name: /code/i }));
    fireEvent.click(screen.getByText('Loop Engineering'));
    expect(screen.getByText('验收器')).toBeTruthy();
  });

  it('Settings 视图可达', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByText('Settings'));
    expect(useUiStore.getState().view).toBe('settings');
    expect(screen.getByText('P2+')).toBeTruthy();
  });
});
