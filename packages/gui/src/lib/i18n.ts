export type Lang = 'zh' | 'en';

type Dictionary = Record<string, string>;

const messages: Record<Lang, Dictionary> = {
  zh: {
    start: '开始',
    settings: '设置',
    allow: '允许',
    deny: '拒绝',
    evidence: '证据',
    cost: '成本',
  },
  en: {
    start: 'Start',
    settings: 'Settings',
    allow: 'Allow',
    deny: 'Deny',
    evidence: 'Evidence',
    cost: 'Cost',
  },
};

let currentLang: Lang = 'zh';

export function setLang(lang: Lang): void {
  currentLang = lang;
}

export function t(key: string): string {
  return messages[currentLang][key] ?? key;
}
