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

export interface StaticItem {
  title: string;
  time: string;
  dot: 'run' | 'gate' | 'ok' | 'err' | 'none';
}

export const STATIC_GROUPS: Record<AppMode, Array<{ heading: string; items: StaticItem[] }>> = {
  chat: [
    { heading: 'PINNED', items: [{ title: 'DeepSeek V4 定价梳理', time: '6/02', dot: 'none' }] },
    {
      heading: 'TODAY',
      items: [{ title: 'Electron 自动更新方案对比', time: '14:02', dot: 'none' }]
    }
  ],
  code: [
    { heading: 'PINNED', items: [{ title: 'GUI 外壳重构 P0', time: 'RUN', dot: 'run' }] },
    {
      heading: 'BOBBY',
      items: [
        { title: '修复 updater 校验失败', time: '待审核', dot: 'gate' },
        { title: 'kernel 事件总线单测补全', time: '11:20', dot: 'ok' }
      ]
    }
  ]
};
