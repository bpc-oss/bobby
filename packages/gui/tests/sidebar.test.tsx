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
  it('shows chat actions in chat mode by default', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    render(<Sidebar />);

    expect(screen.getByText('New Chat')).toBeTruthy();
    expect(screen.queryByText('Search')).toBeNull();
    expect(screen.getAllByRole('button', { name: /projects/i })[0]).toBeTruthy();
    expect(screen.getByText('Write')).toBeTruthy();
    expect(screen.queryByText('Loop Engineering')).toBeNull();
  });

  it('shows code actions without a dedicated projects entry', () => {
    useUiStore.setState({ ...useUiStore.getState(), mode: 'code', lang: 'en' });

    render(<Sidebar />);

    expect(screen.getByText('New Session')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Projects' })).toBeNull();
    expect(screen.getByText('Loop Engineering')).toBeTruthy();
    expect(screen.getByText('Team')).toBeTruthy();
  });

  it('switches view when a function item is clicked', () => {
    useUiStore.setState({ ...useUiStore.getState(), mode: 'code', lang: 'en' });

    render(<Sidebar />);
    fireEvent.click(screen.getByText('Loop Engineering'));

    expect(useUiStore.getState().view).toBe('loop');
  });

  it('switches to settings from the footer button', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    render(<Sidebar />);
    fireEvent.click(screen.getByText('Settings'));

    expect(useUiStore.getState().view).toBe('settings');
  });
});
