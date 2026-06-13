import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StatusBar } from '../src/shell/StatusBar';
import { TitleBar } from '../src/shell/TitleBar';
import { useUiStore } from '../src/store/ui-store';

const initialUi = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initialUi, true);
});

afterEach(() => {
  cleanup();
});

describe('TitleBar', () => {
  it('renders brand, language switch, command entry, sidebar opener, and shell controls', () => {
    useUiStore.setState({
      ...useUiStore.getState(),
      lang: 'zh',
      rightPanelOpen: false,
      rightPanelMenuOpen: false
    });

    render(<TitleBar />);
    expect(screen.getByText('BOBBY')).toBeTruthy();
    expect(screen.getByText('中文')).toBeTruthy();
    expect(screen.getByText('EN')).toBeTruthy();
    expect(screen.getByText(/Ctrl K/i)).toBeTruthy();
    expect(screen.getByLabelText('显示或隐藏侧边栏')).toBeTruthy();
    expect(screen.getByLabelText('刷新')).toBeTruthy();
    expect(screen.getByLabelText('通知')).toBeTruthy();
    expect(screen.getByLabelText('最小化窗口')).toBeTruthy();
    expect(screen.getByLabelText('切换窗口大小')).toBeTruthy();
    expect(screen.getByLabelText('关闭窗口')).toBeTruthy();
    expect(document.querySelector('.title-main')).toBeTruthy();
    expect(document.querySelector('.title-command')).toBeTruthy();
    expect(document.querySelector('.title-command-key')).toBeTruthy();
    expect(document.querySelector('.title-actions')).toBeTruthy();
  });

  it('switches visible copy when the language toggle is used', () => {
    useUiStore.setState({
      ...useUiStore.getState(),
      lang: 'zh',
      rightPanelOpen: false,
      rightPanelMenuOpen: false
    });

    render(<TitleBar />);
    fireEvent.click(screen.getByText('EN'));
    expect(useUiStore.getState().lang).toBe('en');
    expect(screen.getByText('Search or run commands...')).toBeTruthy();
    expect(screen.getByLabelText('Show or hide sidebar')).toBeTruthy();
  });

  it('hides the duplicate sidebar opener once the right panel is already open', () => {
    useUiStore.setState({
      ...useUiStore.getState(),
      lang: 'zh',
      rightPanelOpen: true,
      rightPanelMenuOpen: false
    });

    render(<TitleBar />);
    expect(screen.queryByLabelText('显示或隐藏侧边栏')).toBeNull();
    expect(screen.getByLabelText('刷新')).toBeTruthy();
  });
});

describe('StatusBar', () => {
  it('renders kernel/model/context/mock markers in zh by default', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'zh' });
    render(<StatusBar kernelConnected model="FLASH" contextPct={34} mock />);
    expect(screen.getByText(/FLASH/)).toBeTruthy();
    expect(screen.getByText(/34%/)).toBeTruthy();
    expect(document.querySelectorAll('.status-chip')).toHaveLength(5);
    expect(document.querySelector('.status-context')).toBeTruthy();
    expect(document.querySelector('.status-update')).toBeTruthy();
  });
});
