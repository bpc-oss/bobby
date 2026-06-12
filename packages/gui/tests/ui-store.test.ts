import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../src/store/ui-store';

const initial = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState(initial, true);
});

describe('ui-store', () => {
  it('默认 chat 模式 / session 视图 / 右面板开 / review tab', () => {
    const s = useUiStore.getState();
    expect(s.mode).toBe('chat');
    expect(s.view).toBe('session');
    expect(s.rightPanelOpen).toBe(true);
    expect(s.rightTab).toBe('review');
    expect(s.summaryOpen).toBe(false);
  });

  it('setMode 切模式并把视图重置为 session', () => {
    useUiStore.getState().setView('projects');
    useUiStore.getState().setMode('code');
    expect(useUiStore.getState().mode).toBe('code');
    expect(useUiStore.getState().view).toBe('session');
  });

  it('setView / toggleSummary / toggleRightPanel / setRightTab', () => {
    useUiStore.getState().setView('loop');
    expect(useUiStore.getState().view).toBe('loop');

    useUiStore.getState().toggleSummary();
    expect(useUiStore.getState().summaryOpen).toBe(true);

    useUiStore.getState().toggleRightPanel();
    expect(useUiStore.getState().rightPanelOpen).toBe(false);

    useUiStore.getState().setRightTab('terminal');
    expect(useUiStore.getState().rightTab).toBe('terminal');
    expect(useUiStore.getState().rightPanelOpen).toBe(true);
  });
});
