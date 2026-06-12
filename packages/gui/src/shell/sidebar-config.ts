import type { AppMode, AppView } from '../store/ui-store';

export interface FnItem {
  view: AppView;
  icon: string;
  label: string;
  soon?: boolean;
}

export const FN_ITEMS: Record<AppMode, FnItem[]> = {
  chat: [
    { view: 'session', icon: '◉', label: 'New Chat' },
    { view: 'search', icon: '⌕', label: '搜索' },
    { view: 'write', icon: '✎', label: 'Write', soon: true },
    { view: 'projects', icon: '▣', label: 'Projects' }
  ],
  code: [
    { view: 'session', icon: '◉', label: 'New Session' },
    { view: 'routines', icon: '↻', label: 'Routines', soon: true },
    { view: 'loop', icon: '∞', label: 'Loop Engineering', soon: true },
    { view: 'team', icon: '⧉', label: 'Team', soon: true }
  ]
};
