import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { App } from '../src/main';
import { useChatStore } from '../src/store/chat-store';

type SetupStatus = {
  homeDir: string;
  bobbyDir: string;
  keyPath: string;
  capabilitiesPath: string;
  hasKey: boolean;
  hasCapabilities: boolean;
  hasEnvKey: boolean;
};

function resetStore() {
  useChatStore.setState({
    blocks: [],
    liveReasoning: '',
    liveAssistant: '',
    liveToolContent: '',
    busy: false,
    currentTaskId: null,
    currentPlan: [],
    status: 'idle',
    error: null,
    costUsd: 0,
    spendUsd: 0,
    model: null,
    threads: {},
    taskThreadIds: {},
    pendingThreadIds: [],
    sessions: [],
    activeSessionId: null,
    currentProject: null,
    recentProjects: [],
    _client: null
  });
}

function installBobby(setupStatus: SetupStatus): void {
  (window as Window & { bobby?: unknown }).bobby = {
    send: vi.fn().mockResolvedValue(undefined),
    onEvent: vi.fn().mockReturnValue(() => undefined),
    getSetupStatus: vi.fn().mockResolvedValue(setupStatus),
    getCurrentProject: vi.fn().mockResolvedValue(null),
    listProjects: vi.fn().mockResolvedValue([]),
    listSessions: vi.fn().mockResolvedValue([]),
    openQuickstart: vi.fn().mockResolvedValue(undefined),
    listAutomations: vi.fn().mockResolvedValue([]),
    createAutomation: vi.fn().mockResolvedValue(undefined),
    updateAutomation: vi.fn().mockResolvedValue(undefined),
    toggleAutomation: vi.fn().mockResolvedValue(undefined),
    removeAutomation: vi.fn().mockResolvedValue(true),
    runAutomationNow: vi.fn().mockResolvedValue(undefined)
  };
}

beforeEach(() => {
  resetStore();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  (window as { bobby?: unknown }).bobby = undefined;
});

describe('App onboarding', () => {
  it('shows the wizard until key and capability setup are ready', async () => {
    installBobby({
      homeDir: 'C:\\Users\\Administrator',
      bobbyDir: 'C:\\Users\\Administrator\\.bobby',
      keyPath: 'C:\\Users\\Administrator\\.bobby\\key',
      capabilitiesPath: 'C:\\Users\\Administrator\\.bobby\\capabilities.json',
      hasKey: false,
      hasCapabilities: false,
      hasEnvKey: false
    });

    render(<App />);

    expect(await screen.findByText('Welcome to Bobby')).toBeTruthy();
    expect(screen.getByText('Store your DeepSeek key')).toBeTruthy();
    expect(screen.getByText('Refresh')).toBeTruthy();
    expect(screen.queryByText('Enter workspace')).toBeTruthy();
  });

  it('opens the quickstart docs from onboarding', async () => {
    installBobby({
      homeDir: 'C:\\Users\\Administrator',
      bobbyDir: 'C:\\Users\\Administrator\\.bobby',
      keyPath: 'C:\\Users\\Administrator\\.bobby\\key',
      capabilitiesPath: 'C:\\Users\\Administrator\\.bobby\\capabilities.json',
      hasKey: false,
      hasCapabilities: false,
      hasEnvKey: false
    });

    render(<App />);

    await screen.findByText('Welcome to Bobby');
    fireEvent.click(screen.getByText('Quickstart'));
    expect(window.bobby.openQuickstart).toHaveBeenCalledOnce();
  });

  it('enters the workspace after onboarding is complete', async () => {
    localStorage.setItem('bobby-onboarding-complete', 'true');
    installBobby({
      homeDir: 'C:\\Users\\Administrator',
      bobbyDir: 'C:\\Users\\Administrator\\.bobby',
      keyPath: 'C:\\Users\\Administrator\\.bobby\\key',
      capabilitiesPath: 'C:\\Users\\Administrator\\.bobby\\capabilities.json',
      hasKey: true,
      hasCapabilities: true,
      hasEnvKey: false
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Send')).toBeTruthy();
    });
    expect(screen.queryByText('Welcome to Bobby')).toBeNull();
  });
});
