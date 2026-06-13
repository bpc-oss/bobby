import React from 'react';

import type { Lang } from '../lib/i18n';
import { useUiStore } from '../store/ui-store';

const WINDOW_CONTROLS = [
  { label: { zh: '最小化窗口', en: 'Minimize window' }, glyph: '−', tone: 'quiet' },
  { label: { zh: '切换窗口大小', en: 'Toggle window size' }, glyph: '□', tone: 'quiet' },
  { label: { zh: '关闭窗口', en: 'Close window' }, glyph: '×', tone: 'danger' }
] as const;

function textByLang(lang: Lang, zh: string, en: string): string {
  return lang === 'zh' ? zh : en;
}

function WindowControls({ lang }: { lang: Lang }): JSX.Element {
  return (
    <div className="window-controls" aria-label={textByLang(lang, '窗口控制', 'Window controls')}>
      {WINDOW_CONTROLS.map((item) => (
        <button
          key={item.label.en}
          className={`icon-btn win-btn ${item.tone === 'danger' ? 'danger' : ''}`}
          aria-label={item.label[lang]}
          type="button"
        >
          {item.glyph}
        </button>
      ))}
    </div>
  );
}

export function TitleBar(): JSX.Element {
  const lang = useUiStore((state) => state.lang);
  const setLang = useUiStore((state) => state.setLang);
  const rightPanelOpen = useUiStore((state) => state.rightPanelOpen);
  const toggleRightPanel = useUiStore((state) => state.toggleRightPanel);

  return (
    <div className="titlebar">
      <div className="title-main">
        <span className="brand">
          <i aria-hidden /> BOBBY
        </span>
        <div className="lang-switch" aria-label={textByLang(lang, '语言模式', 'Language mode')}>
          <button className={`lang-btn ${lang === 'zh' ? 'active' : ''}`} type="button" onClick={() => setLang('zh')}>
            中文
          </button>
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} type="button" onClick={() => setLang('en')}>
            EN
          </button>
        </div>
      </div>

      <button
        className="pill palette title-command"
        aria-label={textByLang(lang, '搜索或执行命令 Ctrl K', 'Search or run commands Ctrl K')}
        type="button"
      >
        <span className="title-command-main">
          <span className="title-command-icon" aria-hidden>
            ⌕
          </span>
          <span className="palette-label">{textByLang(lang, '搜索或执行命令...', 'Search or run commands...')}</span>
          <span className="palette-short">{textByLang(lang, '命令...', 'Command...')}</span>
        </span>
        <kbd className="title-command-key">Ctrl K</kbd>
      </button>

      <div className="title-actions">
        {!rightPanelOpen ? (
          <button
            className="icon-btn chrome-btn sidebar-toggle-btn"
            aria-label={textByLang(lang, '显示或隐藏侧边栏', 'Show or hide sidebar')}
            title={textByLang(lang, '显示或隐藏侧边栏 Ctrl+Alt+B', 'Show or hide sidebar Ctrl+Alt+B')}
            type="button"
            onClick={toggleRightPanel}
          >
            ◫
          </button>
        ) : null}
        <button className="icon-btn title-ghost-btn" aria-label={textByLang(lang, '刷新', 'Refresh')} type="button">
          ↻
        </button>
        <button
          className="icon-btn title-ghost-btn notify-btn"
          aria-label={textByLang(lang, '通知', 'Notifications')}
          type="button"
        >
          ◌
        </button>
      </div>

      <WindowControls lang={lang} />
    </div>
  );
}
