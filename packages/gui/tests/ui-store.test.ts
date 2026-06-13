import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../src/store/ui-store';

const initial = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initial, true);
});

describe('ui-store', () => {
  it('defaults to chat mode, session view, closed right sidebar, and review in the panel set', () => {
    const s = useUiStore.getState();
    expect(s.mode).toBe('chat');
    expect(s.view).toBe('session');
    expect(s.rightPanelOpen).toBe(false);
    expect(s.rightPanelMenuOpen).toBe(false);
    expect(s.rightPanels).toEqual(['review']);
    expect(s.activeRightPanel).toBe('review');
    expect(s.summaryOpen).toBe(false);
  });

  it('setMode switches mode and resets the view to session', () => {
    useUiStore.getState().setView('projects');
    useUiStore.getState().setMode('code');
    expect(useUiStore.getState().mode).toBe('code');
    expect(useUiStore.getState().view).toBe('session');
  });

  it('supports opening the sidebar, opening the picker, and managing multiple right-panel tabs', () => {
    useUiStore.getState().setView('loop');
    expect(useUiStore.getState().view).toBe('loop');

    useUiStore.getState().toggleSummary();
    expect(useUiStore.getState().summaryOpen).toBe(true);

    useUiStore.getState().toggleRightPanel();
    expect(useUiStore.getState().rightPanelOpen).toBe(true);
    expect(useUiStore.getState().rightPanelMenuOpen).toBe(false);

    useUiStore.getState().toggleRightPanelMenu();
    expect(useUiStore.getState().rightPanelMenuOpen).toBe(true);

    useUiStore.getState().toggleRightPanelTab('terminal');
    useUiStore.getState().toggleRightPanelTab('browser');
    expect(useUiStore.getState().rightPanels).toEqual(['review', 'terminal', 'browser']);
    expect(useUiStore.getState().activeRightPanel).toBe('browser');
    expect(useUiStore.getState().rightPanelMenuOpen).toBe(true);

    useUiStore.getState().toggleRightPanelMenu();
    expect(useUiStore.getState().rightPanelMenuOpen).toBe(false);

    useUiStore.getState().setActiveRightPanel('terminal');
    expect(useUiStore.getState().activeRightPanel).toBe('terminal');

    useUiStore.getState().toggleRightPanelTab('terminal');
    expect(useUiStore.getState().rightPanels).toEqual(['review', 'browser']);
    expect(useUiStore.getState().activeRightPanel).toBe('browser');
    expect(useUiStore.getState().rightPanelMenuOpen).toBe(false);
  });
});
