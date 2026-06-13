import type { Lang } from '../lib/i18n';
import type { AppMode, AppView } from '../store/ui-store';

export interface FnItem {
  view: AppView;
  icon: string;
  label: string;
  soon?: boolean;
}

export function getFnItems(lang: Lang): Record<AppMode, FnItem[]> {
  return {
    chat: [
      { view: 'session', icon: '◉', label: lang === 'zh' ? '新对话' : 'New Chat' },
      { view: 'projects', icon: '▣', label: lang === 'zh' ? '项目' : 'Projects' },
      { view: 'write', icon: '✎', label: lang === 'zh' ? '写作' : 'Write', soon: true }
    ],
    code: [
      { view: 'session', icon: '□', label: lang === 'zh' ? '新会话' : 'New Session' },
      { view: 'routines', icon: '↺', label: lang === 'zh' ? '例行任务' : 'Routines', soon: true },
      { view: 'loop', icon: '∞', label: lang === 'zh' ? '循环工程' : 'Loop Engineering', soon: true },
      { view: 'team', icon: '⚯', label: lang === 'zh' ? '团队' : 'Team', soon: true }
    ]
  };
}
