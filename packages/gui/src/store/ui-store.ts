import { create } from 'zustand';

import type { Lang } from '../lib/i18n';
import { setLang as setI18nLang } from '../lib/i18n';
import { readStoredValue, UI_LANG_KEY, UI_PROJECT_KEY, writeStoredValue } from '../lib/storage';
import { findProjectById } from '../shell/project-catalog';

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
export type RightTab = 'review' | 'terminal' | 'browser' | 'files';

interface UiState {
  lang: Lang;
  currentProjectId?: string;
  mode: AppMode;
  view: AppView;
  rightPanelOpen: boolean;
  rightPanelMenuOpen: boolean;
  rightPanels: RightTab[];
  activeRightPanel: RightTab;
  summaryOpen: boolean;
  setLang: (lang: Lang) => void;
  setCurrentProjectId: (projectId?: string) => void;
  setMode: (mode: AppMode) => void;
  setView: (view: AppView) => void;
  toggleRightPanelTab: (tab: RightTab) => void;
  setActiveRightPanel: (tab: RightTab) => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanelMenu: () => void;
  closeRightPanelMenu: () => void;
  toggleSummary: () => void;
}

function dedupePanels(panels: RightTab[]): RightTab[] {
  return Array.from(new Set(panels));
}

const initialLang = readStoredValue(UI_LANG_KEY) === 'en' ? 'en' : 'zh';
setI18nLang(initialLang);

export const useUiStore = create<UiState>()((set) => ({
  lang: initialLang,
  currentProjectId: findProjectById(readStoredValue(UI_PROJECT_KEY))?.id,
  mode: 'chat',
  view: 'session',
  rightPanelOpen: false,
  rightPanelMenuOpen: false,
  rightPanels: ['review'],
  activeRightPanel: 'review',
  summaryOpen: false,
  setLang: (lang) => {
    setI18nLang(lang);
    writeStoredValue(UI_LANG_KEY, lang);
    set({ lang });
  },
  setCurrentProjectId: (projectId) => {
    const normalized = findProjectById(projectId)?.id;
    writeStoredValue(UI_PROJECT_KEY, normalized);
    set({ currentProjectId: normalized });
  },
  setMode: (mode) => set({ mode, view: 'session' }),
  setView: (view) => set({ view }),
  toggleRightPanelTab: (tab) =>
    set((state) => {
      const exists = state.rightPanels.includes(tab);
      const next = exists ? state.rightPanels.filter((item) => item !== tab) : dedupePanels([...state.rightPanels, tab]);
      const fallback = next[next.length - 1] ?? 'review';
      const activeRightPanel = exists
        ? state.activeRightPanel === tab
          ? fallback
          : state.activeRightPanel
        : tab;

      return {
        rightPanels: next.length > 0 ? next : ['review'],
        activeRightPanel: next.length > 0 ? activeRightPanel : 'review',
        rightPanelOpen: true,
        rightPanelMenuOpen: state.rightPanelMenuOpen
      };
    }),
  setActiveRightPanel: (tab) =>
    set((state) =>
      state.rightPanels.includes(tab)
        ? {
            activeRightPanel: tab,
            rightPanelOpen: true
          }
        : state
    ),
  toggleRightPanel: () =>
    set((state) => ({
      rightPanelOpen: !state.rightPanelOpen,
      rightPanelMenuOpen: false
    })),
  setRightPanelOpen: (open) =>
    set({
      rightPanelOpen: open,
      rightPanelMenuOpen: false
    }),
  toggleRightPanelMenu: () =>
    set((state) => ({
      rightPanelMenuOpen: !state.rightPanelMenuOpen,
      rightPanelOpen: true,
      activeRightPanel: state.activeRightPanel
    })),
  closeRightPanelMenu: () => set({ rightPanelMenuOpen: false }),
  toggleSummary: () => set((state) => ({ summaryOpen: !state.summaryOpen }))
}));
