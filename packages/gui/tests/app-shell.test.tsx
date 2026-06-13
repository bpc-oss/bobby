import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setKernelClient } from '../src/kernel';
import type { KernelClient } from '../src/kernel/client';
import { AppShell } from '../src/shell/AppShell';
import { useSessionStore } from '../src/store/session-store';
import { useUiStore } from '../src/store/ui-store';

const initialUi = useUiStore.getState();
const initialSession = useSessionStore.getState();

function stubClient(overrides: Partial<KernelClient> = {}): KernelClient {
  return {
    listSessions: vi.fn(async () => []),
    createSession: vi.fn(async () => ({
      id: 'x',
      mode: 'chat' as const,
      title: 'New Chat',
      pinned: false,
      status: 'idle' as const,
      updatedAt: ''
    })),
    startTask: vi.fn(async () => undefined),
    approveGate: vi.fn(async () => undefined),
    onEvent: vi.fn(() => () => undefined),
    ...overrides
  };
}

beforeEach(() => {
  useUiStore.setState(initialUi, true);
  useSessionStore.setState(initialSession, true);
  setKernelClient(stubClient());
});

afterEach(() => {
  cleanup();
  setKernelClient(null);
});

describe('AppShell', () => {
  it('renders chat mode with the right sidebar closed by default', () => {
    render(<AppShell />);
    expect(screen.getByText('BOBBY')).toBeTruthy();
    expect(document.querySelector('.side-list')?.textContent).not.toContain('New Chat');
    expect(document.querySelector('.app-grid.right-closed')).toBeTruthy();
  });

  it('enters a draft chat when the new chat button is clicked without creating a stored session', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    render(<AppShell />);
    fireEvent.click(screen.getAllByText('New Chat')[0].closest('button') as HTMLButtonElement);

    expect(useUiStore.getState().view).toBe('session');
    expect(useSessionStore.getState().activeSessionId).toBeUndefined();
    expect(document.querySelector('textarea.input')).toBeTruthy();
    expect(Object.keys(useSessionStore.getState().sessions)).toHaveLength(0);
  });

  it('does not surface legacy empty New Chat rows returned by the kernel list', async () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    setKernelClient(
      stubClient({
        listSessions: vi.fn(async (mode) =>
          mode === 'chat'
            ? [
                {
                  id: 'legacy-empty',
                  mode: 'chat' as const,
                  title: 'New Chat',
                  pinned: false,
                  status: 'idle' as const,
                  updatedAt: '2026-06-13T10:00:00Z'
                },
                {
                  id: 'real-chat',
                  mode: 'chat' as const,
                  title: 'Fix the sidebar',
                  pinned: false,
                  status: 'done' as const,
                  updatedAt: '2026-06-13T11:00:00Z'
                }
              ]
            : []
        )
      })
    );

    render(<AppShell />);

    await waitFor(() => {
      expect(document.querySelector('.side-list')?.textContent).toContain('Fix the sidebar');
    });
    expect(document.querySelector('.side-list')?.textContent).not.toContain('New Chat');
  });

  it('opens the right sidebar on demand from the title bar toggle, then hides the duplicate opener', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    render(<AppShell />);
    fireEvent.click(screen.getByRole('button', { name: /show or hide side(?:bar| panel)/i }));
    expect(document.querySelector('.app-grid.right-open')).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('button', { name: /show or hide side(?:bar| panel)/i })).toBeNull();
  });

  it('switches to code mode and still shows the loop placeholder', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    render(<AppShell />);
    fireEvent.click(screen.getByRole('tab', { name: /code/i }));
    fireEvent.click(screen.getByText('Loop Engineering'));
    expect(document.querySelector('.wizard')).toBeTruthy();
    expect(useUiStore.getState().view).toBe('loop');
  });

  it('reaches the settings view', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    render(<AppShell />);
    fireEvent.click(screen.getByText('Settings'));
    expect(useUiStore.getState().view).toBe('settings');
    expect(screen.getByRole('heading', { name: 'General' })).toBeTruthy();
  });

  it('opens a content-projects surface in chat mode', () => {
    useUiStore.setState({ ...useUiStore.getState(), lang: 'en' });

    render(<AppShell />);

    fireEvent.click(screen.getAllByRole('button', { name: /projects/i })[0]);

    expect(useUiStore.getState().view).toBe('projects');
    expect(screen.getAllByRole('button', { name: /projects/i })[0].className).toContain('active');
    expect(screen.getByRole('heading', { name: 'Content projects' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Long-form writing' })).toBeTruthy();
  });
});
