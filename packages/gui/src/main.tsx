import React from 'react';

import { createRoot } from 'react-dom/client';

import { setLang, t } from './lib/i18n';
import { Wizard } from './screens/Wizard';
import { Workspace } from './screens/Workspace';
import { History } from './screens/History';
import { Settings } from './screens/Settings';
import { Plugins } from './screens/Plugins';
import { makeKernelClient } from './ipc/contract';
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

function App(): JSX.Element {
  const [screen, setScreen] = React.useState<Screen>('workspace');
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  const [lang, setLanguage] = React.useState<'zh' | 'en'>('zh');
  const client = resolveKernelClient();

  React.useEffect(() => {
    setLang(lang);
  }, [lang]);

  const showHelp = (
    <section className="app-help-error">
      <h3 className="screen-title">帮助与错误</h3>
      <p className="muted">若遇到闸口拒绝、长时间无响应或证据失败，优先查看“证据”面板的失败原因。</p>
    </section>
  );

  return (
    <div className={`app-shell ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      <header className="app-header">
        <h1 className="app-brand">Bobby</h1>
        <nav className="app-nav">
          <button aria-current={screen === 'workspace' ? 'page' : undefined} onClick={() => setScreen('workspace')}>
            工作区
          </button>
          <button aria-current={screen === 'wizard' ? 'page' : undefined} onClick={() => setScreen('wizard')}>
            首启向导
          </button>
          <button aria-current={screen === 'history' ? 'page' : undefined} onClick={() => setScreen('history')}>
            历史
          </button>
          <button aria-current={screen === 'settings' ? 'page' : undefined} onClick={() => setScreen('settings')}>
            {t('settings')}
          </button>
          <button aria-current={screen === 'plugins' ? 'page' : undefined} onClick={() => setScreen('plugins')}>
            插件
          </button>
          <button onClick={() => setLanguage('zh')}>中文</button>
          <button onClick={() => setLanguage('en')}>English</button>
          <button onClick={() => setTheme((value) => (value === 'light' ? 'dark' : 'light'))}>
            {theme === 'light' ? '暗色' : '亮色'}
          </button>
        </nav>
      </header>

      <main className="app-main">
        <section className="screen-shell">
          {screen === 'workspace' && (
            <Workspace kernelClient={client ?? undefined} theme={theme} onThemeChange={setTheme} />
          )}
          {screen === 'wizard' && <Wizard onStart={() => setScreen('workspace')} />}
          {screen === 'history' && <History />}
          {screen === 'settings' && <Settings />}
          {screen === 'plugins' && <Plugins />}
          {showHelp}
        </section>
      </main>

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
