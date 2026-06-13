import React from 'react';

import { useSessionStore } from '../store/session-store';
import type { RightTab } from '../store/ui-store';
import { useUiStore } from '../store/ui-store';
import { ReviewPanel } from './ReviewPanel';

const PANEL_META = {
  review: { icon: '⊕', zh: '审查', en: 'Review', shortcut: 'Ctrl+Shift+G' },
  terminal: { icon: '⌘', zh: '终端', en: 'Terminal', shortcut: '' },
  browser: { icon: '◌', zh: '浏览器', en: 'Browser', shortcut: 'Ctrl+T' },
  files: { icon: '▣', zh: '文件', en: 'Files', shortcut: 'Ctrl+P' }
} satisfies Record<RightTab, { icon: string; zh: string; en: string; shortcut: string }>;

function panelLabel(tab: RightTab, lang: 'zh' | 'en'): string {
  return PANEL_META[tab][lang];
}

function TerminalPreview({ lang }: { lang: 'zh' | 'en' }): JSX.Element {
  return (
    <div className="rp-preview-stack">
      <div className="term">
        <div>
          <span className="ps">bobby {'>'}</span> pnpm --filter @bobby/gui package
        </div>
        <div>vite v5.3.0 building for production...</div>
        <div>OK 214 modules transformed.</div>
        <div>OK built in 42.3s</div>
        <div>
          <span className="ps">bobby {'>'}</span> node scripts/verify-sig.mjs
        </div>
        <div>sha512 OK / signature OK</div>
        <div className="dim">
          {lang === 'zh'
            ? '这里先保留只读命令流和执行痕迹，交互终端放到后续阶段。'
            : 'This keeps a read-only command stream for now. Interactive terminal support comes later.'}
        </div>
      </div>
    </div>
  );
}

function BrowserPreview({ lang }: { lang: 'zh' | 'en' }): JSX.Element {
  return (
    <div className="rp-preview-stack">
      <div className="web-bar">
        <input readOnly value="http://localhost:5173" />
        <span className="chip">{lang === 'zh' ? '前往' : 'Go'}</span>
      </div>
      <div className="web-frame">
        {lang === 'zh' ? '内嵌浏览器预览区域\n开发服务器 / 文档 / 本地页面' : 'Embedded browser preview\nDev server / docs / local pages'}
      </div>
    </div>
  );
}

function FilesPreview({ lang }: { lang: 'zh' | 'en' }): JSX.Element {
  return (
    <div className="rp-preview-stack">
      <div className="sc-note">
        {lang === 'zh'
          ? '文件抽屉按需打开，用来查看当前会话相关改动、证据文件和工作区入口。'
          : 'Open the files drawer on demand to inspect related changes, evidence files, and workspace entry points.'}
      </div>
      <div className="sc-msg me">packages/gui/electron-builder.yml</div>
      <div className="sc-msg">release/latest.yml / scripts/verify-sig.mjs / docs/superpowers/specs/...</div>
    </div>
  );
}

function PanelContent({
  tab,
  preview,
  lang
}: {
  tab: RightTab;
  preview: boolean;
  lang: 'zh' | 'en';
}): JSX.Element {
  if (tab === 'review') return <ReviewPanel />;
  if (preview && tab === 'terminal') return <TerminalPreview lang={lang} />;
  if (preview && tab === 'browser') return <BrowserPreview lang={lang} />;
  if (preview && tab === 'files') return <FilesPreview lang={lang} />;
  if (tab === 'terminal') {
    return <div className="rp-empty rp-empty-inline">{lang === 'zh' ? '这里先显示只读命令流，交互终端放到后续阶段。' : 'This rail shows a read-only command stream for now. Interactive terminal support comes later.'}</div>;
  }
  if (tab === 'browser') {
    return <div className="rp-empty rp-empty-inline">{lang === 'zh' ? '这里预留内嵌浏览器面板，后续再接真实页面流。' : 'This reserves the embedded browser rail. Real page wiring comes later.'}</div>;
  }
  return <div className="rp-empty rp-empty-inline">{lang === 'zh' ? '文件抽屉按需打开，用来查看当前会话的改动、证据与工作区入口。' : 'Open the files drawer on demand to inspect changes, evidence, and workspace entry points for the current session.'}</div>;
}

function PanelPickerMenu({
  activePanels,
  onToggle,
  lang
}: {
  activePanels: RightTab[];
  onToggle: (tab: RightTab) => void;
  lang: 'zh' | 'en';
}): JSX.Element {
  return (
    <div className="rp-picker-menu" role="menu">
      {(Object.keys(PANEL_META) as RightTab[]).map((tab) => {
        const checked = activePanels.includes(tab);

        return (
          <button
            key={tab}
            className={`rp-picker-item ${checked ? 'active' : ''}`}
            role="menuitemcheckbox"
            aria-checked={checked}
            type="button"
            onClick={() => onToggle(tab)}
          >
            <span className="rp-picker-left">
              <span className="rp-picker-icon" aria-hidden>
                {PANEL_META[tab].icon}
              </span>
              <span>{panelLabel(tab, lang)}</span>
            </span>
            {PANEL_META[tab].shortcut ? <span className="rp-shortcut">{PANEL_META[tab].shortcut}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function PanelTabs({
  panels,
  activePanel,
  onSelect,
  onCloseTab,
  onOpenMenu,
  lang
}: {
  panels: RightTab[];
  activePanel: RightTab;
  onSelect: (tab: RightTab) => void;
  onCloseTab: (tab: RightTab) => void;
  onOpenMenu: () => void;
  lang: 'zh' | 'en';
}): JSX.Element {
  return (
    <div className="rp-tabstrip-shell">
      <div className="rp-tabstrip" role="tablist" aria-label={lang === 'zh' ? '右侧面板标签' : 'Right rail tabs'}>
        {panels.map((tab) => {
          const active = tab === activePanel;

          return (
            <div
              key={tab}
              className={`rp-tab-chip ${active ? 'active' : ''}`}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              onClick={() => onSelect(tab)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(tab);
                }
              }}
            >
              <span className="rp-tab-chip-main">
                <span className="rp-picker-icon" aria-hidden>
                  {PANEL_META[tab].icon}
                </span>
                <span>{panelLabel(tab, lang)}</span>
              </span>
              <button
                className="rp-tab-close"
                aria-label={lang === 'zh' ? `关闭${panelLabel(tab, lang)}` : `Close ${panelLabel(tab, lang)}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <button className="rp-tab-add" aria-label={lang === 'zh' ? '打开面板菜单' : 'Open panel menu'} type="button" onClick={onOpenMenu}>
        +
      </button>
    </div>
  );
}

function PanelHeader({
  activePanels,
  activePanel,
  menuOpen,
  onClose,
  onToggleMenu,
  onSelectPanel,
  onTogglePanel,
  lang
}: {
  activePanels: RightTab[];
  activePanel: RightTab;
  menuOpen: boolean;
  onClose: () => void;
  onToggleMenu: () => void;
  onSelectPanel: (tab: RightTab) => void;
  onTogglePanel: (tab: RightTab) => void;
  lang: 'zh' | 'en';
}): JSX.Element {
  return (
    <div className="rp-head codex-like">
      <PanelTabs panels={activePanels} activePanel={activePanel} onSelect={onSelectPanel} onCloseTab={onTogglePanel} onOpenMenu={onToggleMenu} lang={lang} />
      <div className="rp-head-actions">
        <button className="rp-window-btn" aria-label={lang === 'zh' ? '关闭侧边栏' : 'Close sidebar'} type="button" onClick={onClose}>
          ◫
        </button>
      </div>
      {menuOpen ? <PanelPickerMenu activePanels={activePanels} onToggle={onTogglePanel} lang={lang} /> : null}
    </div>
  );
}

export function RightPanel(): JSX.Element {
  const lang = useUiStore((state) => state.lang);
  const open = useUiStore((state) => state.rightPanelOpen);
  const menuOpen = useUiStore((state) => state.rightPanelMenuOpen);
  const panels = useUiStore((state) => state.rightPanels);
  const activePanel = useUiStore((state) => state.activeRightPanel);
  const togglePanel = useUiStore((state) => state.toggleRightPanelTab);
  const setActivePanel = useUiStore((state) => state.setActiveRightPanel);
  const toggle = useUiStore((state) => state.toggleRightPanel);
  const toggleMenu = useUiStore((state) => state.toggleRightPanelMenu);
  const closeMenu = useUiStore((state) => state.closeRightPanelMenu);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const preview = activeSessionId === 'code-gate';

  return (
    <aside className={`right ${open ? 'open' : 'collapsed'}`}>
      {open ? (
        <>
          <PanelHeader
            activePanels={panels}
            activePanel={activePanel}
            menuOpen={menuOpen}
            onClose={toggle}
            onToggleMenu={toggleMenu}
            onSelectPanel={setActivePanel}
            onTogglePanel={togglePanel}
            lang={lang}
          />
          <div className="rp-body" onClick={menuOpen ? closeMenu : undefined}>
            <div className="rp-panel-view" data-panel={activePanel}>
              <PanelContent tab={activePanel} preview={preview} lang={lang} />
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}
