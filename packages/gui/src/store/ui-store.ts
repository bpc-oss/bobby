import { create } from 'zustand';

export type AppMode = 'chat' | 'code';
export type AppView =
  | 'session'
  | 'search'
  | 'write'
  | 'projects'
  | 'routines'
  | 'loop'
  | 'team'
  | 'settings';
export type RightTab = 'review' | 'terminal' | 'web' | 'sidechat';

interface UiState {
  mode: AppMode;
  view: AppView;
  rightPanelOpen: boolean;
  rightTab: RightTab;
  summaryOpen: boolean;
  setMode: (mode: AppMode) => void;
  setView: (view: AppView) => void;
  setRightTab: (tab: RightTab) => void;
  toggleRightPanel: () => void;
  toggleSummary: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  mode: 'chat',
  view: 'session',
  rightPanelOpen: true,
  rightTab: 'review',
  summaryOpen: false,
  setMode: (mode) => set({ mode, view: 'session' }),
  setView: (view) => set({ view }),
  setRightTab: (tab) => set({ rightTab: tab, rightPanelOpen: true }),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  toggleSummary: () => set((state) => ({ summaryOpen: !state.summaryOpen }))
}));
