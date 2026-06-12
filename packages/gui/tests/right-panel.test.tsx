import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RightPanel } from '../src/panels/RightPanel';
import { useUiStore } from '../src/store/ui-store';

const initial = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initial, true);
});

afterEach(() => {
  cleanup();
});

describe('RightPanel', () => {
  it('默认显示审查 tab 内容', () => {
    render(<RightPanel />);
    expect(screen.getByRole('tab', { name: /审查/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('点击终端 tab 切换', () => {
    render(<RightPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /终端/ }));
    expect(useUiStore.getState().rightTab).toBe('terminal');
  });

  it('折叠按钮收起面板', () => {
    render(<RightPanel />);
    fireEvent.click(screen.getByLabelText('折叠面板'));
    expect(useUiStore.getState().rightPanelOpen).toBe(false);
  });
});
