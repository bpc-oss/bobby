import React from 'react';

import { createRoot } from 'react-dom/client';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';

import { setLang, t } from './lib/i18n';
import { makeKernelClient } from './ipc/contract';
import './lib/theme.css';
import { History } from './screens/History';
import { Plugins } from './screens/Plugins';
import { Settings } from './screens/Settings';
import { Wizard } from './screens/Wizard';
import { Workspace } from './screens/Workspace';
import './app.css';

type Screen = 'wizard' | 'workspace' | 'history' | 'settings' | 'plugins';

type KernelClient = ReturnType<typeof makeKernelClient>;

function resolveKernelClient(): KernelClient | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (((window as unknown as { bobby?: unknown }).bobby) !== undefined) {
    return makeKernelClient();
  }

  return null;
}

type TopNavProps = {
  current: Screen;
  onSelect: (next: Screen) => void;
  onLanguage: (lang: 'zh' | 'en') => void;
  onThemeToggle: () => void;
  theme: 'light' | 'dark';
};

function NavButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button aria-current={active ? 'page' : undefined} onClick={onClick}>
      {children}
    </button>
  );
}

function TopNav({
  current,
  onSelect,
  onLanguage,
  onThemeToggle,
  theme
}: TopNavProps): JSX.Element {
  return (
    <header className="app-header">
      <h1 className="app-brand">Bobby</h1>
      <nav className="app-nav">
        <NavButton active={current === 'workspace'} onClick={() => onSelect('workspace')}>
          工作区
        </NavButton>
        <NavButton active={current === 'wizard'} onClick={() => onSelect('wizard')}>
          首启向导
        </NavButton>
        <NavButton active={current === 'history'} onClick={() => onSelect('history')}>
          历史
        </NavButton>
        <NavButton active={current === 'settings'} onClick={() => onSelect('settings')}>
          {t('settings')}
        </NavButton>
        <NavButton active={current === 'plugins'} onClick={() => onSelect('plugins')}>
          插件
        </NavButton>
        <button onClick={() => onLanguage('zh')}>中文</button>
        <button onClick={() => onLanguage('en')}>English</button>
        <button onClick={onThemeToggle}>{theme === 'light' ? '暗色' : '亮色'}</button>
      </nav>
    </header>
  );
}

function HelpPanel(): JSX.Element {
  return (
    <section className="app-help-error">
      <h3 className="screen-title">帮助与错误</h3>
      <p className="muted">若遇到闸口拒绝、长时间无响应或证据失败，优先查看“证据”面板的失败原因。</p>
    </section>
  );
}

function ScreenContent({
  screen,
  client,
  theme,
  onThemeChange,
  onStartWorkspace
}: {
  screen: Screen;
  client: KernelClient | null;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  onStartWorkspace: () => void;
}): JSX.Element {
  return (
    <main className="app-main">
      <section className="screen-shell">
        {screen === 'workspace' && <Workspace kernelClient={client ?? undefined} theme={theme} onThemeChange={onThemeChange} />}
        {screen === 'wizard' && <Wizard onStart={onStartWorkspace} />}
        {screen === 'history' && <History />}
        {screen === 'settings' && <Settings />}
        {screen === 'plugins' && <Plugins />}
        <HelpPanel />
      </section>
    </main>
  );
}

function App(): JSX.Element {
  const [screen, setScreen] = React.useState<Screen>('workspace');
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const [lang, setLanguage] = React.useState<'zh' | 'en'>('zh');
  const client = resolveKernelClient();

  React.useEffect(() => {
    setLang(lang);
  }, [lang]);

  return (
    <div className={`app-shell ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      <TopNav
        current={screen}
        onSelect={(next) => {
          setScreen(next);
        }}
        onLanguage={(nextLang) => {
          setLanguage(nextLang);
        }}
        onThemeToggle={() => {
          setTheme((current) => (current === 'light' ? 'dark' : 'light'));
        }}
        theme={theme}
      />
      <ScreenContent
        screen={screen}
        client={client}
        theme={theme}
        onThemeChange={setTheme}
        onStartWorkspace={() => setScreen('workspace')}
      />
      <footer className="app-footer">
        <span>状态：{screen}</span>
      </footer>
    </div>
  );
}

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(<App />);
}
