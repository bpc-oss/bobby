import type { Lang } from '../lib/i18n';

export type SettingsSectionKey =
  | 'general'
  | 'profile'
  | 'appearance'
  | 'agent'
  | 'personalization'
  | 'keyboard'
  | 'usage'
  | 'mcp'
  | 'browser'
  | 'computer'
  | 'hooks'
  | 'connections'
  | 'git'
  | 'environment'
  | 'worktree';

export type SettingsGroup = {
  key: string;
  title: string;
  sections: Array<{
    key: SettingsSectionKey;
    label: string;
    description: string;
  }>;
};

type SettingsCopy = {
  title: string;
  back: string;
  search: string;
  sectionNote: string;
  notConnectedYet: string;
  personal: string;
  integrations: string;
  coding: string;
  general: {
    title: string;
    description: string;
    languageLabel: string;
    modelLabel: string;
    routeLabel: string;
    budgetLabel: string;
    permissionLabel: string;
    sandboxLabel: string;
  };
  languages: {
    zh: string;
    en: string;
  };
};

const copy: Record<Lang, SettingsCopy> = {
  zh: {
    title: '设置',
    back: '返回应用',
    search: '搜索设置',
    sectionNote: '这一部分先对齐 Codex 的结构，能力会逐步接入 Bobby。',
    notConnectedYet: '该模块尚未接入 Bobby 实际能力。',
    personal: '个人',
    integrations: '集成',
    coding: '编码',
    general: {
      title: '常规',
      description: '统一管理语言、模型路由、预算、权限和沙箱策略。',
      languageLabel: '界面语言',
      modelLabel: '模型',
      routeLabel: '路由',
      budgetLabel: '预算上限 (USD)',
      permissionLabel: '默认权限层级',
      sandboxLabel: '强化沙箱'
    },
    languages: {
      zh: '中文',
      en: '英文'
    }
  },
  en: {
    title: 'Settings',
    back: 'Back to app',
    search: 'Search settings',
    sectionNote: 'This section follows the Codex structure first and Bobby capabilities will be connected incrementally.',
    notConnectedYet: 'This module is not connected to Bobby capabilities yet.',
    personal: 'Personal',
    integrations: 'Integrations',
    coding: 'Coding',
    general: {
      title: 'General',
      description: 'Manage language, model routing, budget, permissions, and sandbox policy in one place.',
      languageLabel: 'Interface language',
      modelLabel: 'Model',
      routeLabel: 'Route',
      budgetLabel: 'Budget cap (USD)',
      permissionLabel: 'Default permission tier',
      sandboxLabel: 'Strong sandbox'
    },
    languages: {
      zh: 'Chinese',
      en: 'English'
    }
  }
};

export function getSettingsCopy(lang: Lang): SettingsCopy {
  return copy[lang];
}

export function getSettingsGroups(lang: Lang): SettingsGroup[] {
  const c = copy[lang];

  return [
    {
      key: 'personal',
      title: c.personal,
      sections: [
        { key: 'general', label: c.general.title, description: c.general.description },
        { key: 'profile', label: lang === 'zh' ? '个人资料' : 'Profile', description: c.sectionNote },
        { key: 'appearance', label: lang === 'zh' ? '外观' : 'Appearance', description: c.sectionNote },
        { key: 'agent', label: 'Agent', description: c.sectionNote },
        { key: 'personalization', label: lang === 'zh' ? '个性化' : 'Personalization', description: c.sectionNote },
        { key: 'keyboard', label: lang === 'zh' ? '键盘快捷键' : 'Keyboard Shortcuts', description: c.sectionNote },
        { key: 'usage', label: lang === 'zh' ? '使用情况和计费' : 'Usage & Billing', description: c.sectionNote }
      ]
    },
    {
      key: 'integrations',
      title: c.integrations,
      sections: [
        { key: 'mcp', label: lang === 'zh' ? 'MCP 服务器' : 'MCP Servers', description: c.sectionNote },
        { key: 'browser', label: lang === 'zh' ? '浏览器' : 'Browser', description: c.sectionNote },
        { key: 'computer', label: lang === 'zh' ? '电脑操控' : 'Computer Control', description: c.sectionNote }
      ]
    },
    {
      key: 'coding',
      title: c.coding,
      sections: [
        { key: 'hooks', label: lang === 'zh' ? '钩子' : 'Hooks', description: c.sectionNote },
        { key: 'connections', label: lang === 'zh' ? '连接' : 'Connections', description: c.sectionNote },
        { key: 'git', label: 'Git', description: c.sectionNote },
        { key: 'environment', label: lang === 'zh' ? '环境' : 'Environment', description: c.sectionNote },
        { key: 'worktree', label: lang === 'zh' ? '工作树' : 'Working Tree', description: c.sectionNote }
      ]
    }
  ];
}
