import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Settings } from '../src/screens/Settings';
import { useUiStore } from '../src/store/ui-store';

const initialUi = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initialUi, true);
});

afterEach(() => {
  cleanup();
});

describe('Settings', () => {
  it('renders grouped settings navigation and opens the general section by default', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    render(<Settings />);

    expect(screen.getByRole('textbox', { name: /search settings/i })).toBeTruthy();
    expect(screen.getByText('Personal')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'General' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: 'General' })).toBeTruthy();
  });

  it('switches sections from the left navigation', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: 'Git' }));

    expect(screen.getByRole('heading', { name: 'Git' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'General' })).toBeNull();
  });

  it('filters sections by search query', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    render(<Settings />);
    fireEvent.change(screen.getByRole('textbox', { name: /search settings/i }), {
      target: { value: 'git' }
    });

    expect(screen.getByRole('button', { name: 'Git' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'General' })).toBeNull();
  });

  it('updates the interface language from the general section', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    render(<Settings />);
    fireEvent.change(screen.getByLabelText('Interface language'), {
      target: { value: 'zh' }
    });

    expect(useUiStore.getState().lang).toBe('zh');
    expect(screen.getByRole('heading', { name: '常规' })).toBeTruthy();
  });
});
