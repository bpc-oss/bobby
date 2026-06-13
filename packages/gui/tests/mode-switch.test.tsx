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
  it('renders two tabs and keeps chat selected by default in zh mode', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'zh' });
    render(<ModeSwitch />);
    const chat = screen.getByRole('tab', { name: /对话/i });
    const code = screen.getByRole('tab', { name: /代码/i });
    expect(chat.getAttribute('aria-selected')).toBe('true');
    expect(code.getAttribute('aria-selected')).toBe('false');
  });

  it('switches to code mode and resets the view', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'zh' });
    useUiStore.getState().setView('projects');
    render(<ModeSwitch />);
    fireEvent.click(screen.getByRole('tab', { name: /代码/i }));
    expect(useUiStore.getState().mode).toBe('code');
    expect(useUiStore.getState().view).toBe('session');
  });

  it('shows the badge when codeBadge is greater than zero', () => {
    render(<ModeSwitch codeBadge={2} />);
    expect(screen.getByText('2')).toBeTruthy();
  });
});
