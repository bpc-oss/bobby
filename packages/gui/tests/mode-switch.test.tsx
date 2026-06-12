import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ModeSwitch } from '../src/shell/ModeSwitch';
import { useUiStore } from '../src/store/ui-store';

const initial = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initial, true);
});

afterEach(() => {
  cleanup();
});

describe('ModeSwitch', () => {
  it('渲染 Chat / Code 两个分段，chat 默认激活', () => {
    render(<ModeSwitch />);
    const chat = screen.getByRole('tab', { name: /chat/i });
    const code = screen.getByRole('tab', { name: /code/i });
    expect(chat.getAttribute('aria-selected')).toBe('true');
    expect(code.getAttribute('aria-selected')).toBe('false');
  });

  it('点击 Code 切换模式并重置视图', () => {
    useUiStore.getState().setView('projects');
    render(<ModeSwitch />);
    fireEvent.click(screen.getByRole('tab', { name: /code/i }));
    expect(useUiStore.getState().mode).toBe('code');
    expect(useUiStore.getState().view).toBe('session');
  });

  it('badge>0 时显示角标', () => {
    render(<ModeSwitch codeBadge={2} />);
    expect(screen.getByText('2')).toBeTruthy();
  });
});
