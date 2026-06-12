import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Sidebar } from '../src/shell/Sidebar';
import { useUiStore } from '../src/store/ui-store';

const initial = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initial, true);
});

afterEach(() => {
  cleanup();
});

describe('Sidebar', () => {
  it('chat 模式显示 chat 功能项', () => {
    render(<Sidebar />);
    expect(screen.getByText('New Chat')).toBeTruthy();
    expect(screen.getByText('Write')).toBeTruthy();
    expect(screen.queryByText('Loop Engineering')).toBeNull();
  });

  it('code 模式显示 code 功能项', () => {
    useUiStore.getState().setMode('code');
    render(<Sidebar />);
    expect(screen.getByText('New Session')).toBeTruthy();
    expect(screen.getByText('Routines')).toBeTruthy();
    expect(screen.getByText('Loop Engineering')).toBeTruthy();
    expect(screen.getByText('Team')).toBeTruthy();
  });

  it('点击功能项切换视图', () => {
    useUiStore.getState().setMode('code');
    render(<Sidebar />);
    fireEvent.click(screen.getByText('Loop Engineering'));
    expect(useUiStore.getState().view).toBe('loop');
  });

  it('底部 Settings 切到 settings 视图', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByText('Settings'));
    expect(useUiStore.getState().view).toBe('settings');
  });
});
