import React from 'react';
import { createRoot } from 'react-dom/client';
import { setLang, t } from './lib/i18n';
import { makeKernelClient } from './ipc/contract';
import { useChatStore } from './store/chat-store';
import { Workspace } from './screens/Workspace';
import { Settings } from './screens/Settings';
import { RightPanel } from './components/RightPanel';
import { ReviewPanel } from './components/ReviewPanel';
import { WriteMode } from './screens/WriteMode';
import { PluginMarketplace } from './screens/PluginMarketplace';
import { ScheduleTasks } from './screens/ScheduleTasks';
import { ClawMode } from './screens/ClawMode';
import { CodeMode } from './screens/CodeMode';
import './styles/tokens.css';

function resolveKernelClient() {
  if (typeof window === 'undefined') return null;
  if ((window as any).bobby !== undefined) return makeKernelClient();
  return null;
}

function Sidebar({ theme, onThemeChange, onPage }: { theme: string; onThemeChange: (t: 'light' | 'dark') => void; onPage: (p: string) => void }) {
  const sessions = useChatStore(s => s.sessions);
  const blocks = useChatStore(s => s.blocks);
  const busy = useChatStore(s => s.busy);
  const status = useChatStore(s => s.status);
  const newSession = useChatStore(s => s.newSession);
  const switchSession = useChatStore(s => s.switchSession);
  const hasContent = blocks.length > 0;

  return React.createElement('aside', {
    className: 'flex h-full w-[260px] flex-col border-r',
    style: { background: 'var(--bobby-bg-sidebar)', borderColor: 'var(--bobby-sidebar-border)' }
  },
    React.createElement('div', { className: 'flex items-center justify-between px-4 py-3 border-b', style: { borderColor: 'var(--bobby-sidebar-divider)' } },
      React.createElement('h1', { className: 'text-[13px] font-bold text-bobby-ink select-none' }, 'Bobby'),
      React.createElement('div', { className: 'flex items-center gap-1' },
        React.createElement('button', { onClick: () => onPage('write'), className: 'h-7 w-7 rounded-lg text-bobby-muted hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink flex items-center justify-center text-[14px]', title: 'Write' }, '✍️'),
        React.createElement('button', { onClick: () => onPage('code'), className: 'h-7 w-7 rounded-lg text-bobby-muted hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink flex items-center justify-center text-[14px]', title: 'Code' }, '⌨️'),
        React.createElement('button', { onClick: () => onPage('plugins'), className: 'h-7 w-7 rounded-lg text-bobby-muted hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink flex items-center justify-center text-[14px]', title: 'Plugins' }, '🧩'),
        React.createElement('button', { onClick: () => onPage('schedule'), className: 'h-7 w-7 rounded-lg text-bobby-muted hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink flex items-center justify-center text-[14px]', title: 'Schedule' }, '⏰'),
        React.createElement('button', { onClick: () => onPage('claw'), className: 'h-7 w-7 rounded-lg text-bobby-muted hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink flex items-center justify-center text-[14px]', title: 'Connect' }, '📱'),
        React.createElement('button', { onClick: () => onPage('settings'), className: 'h-7 w-7 rounded-lg text-bobby-muted hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink flex items-center justify-center text-[14px]', title: 'Settings' }, '⚙️'),
        React.createElement('button', { onClick: newSession, disabled: busy || !hasContent, className: 'h-7 w-7 rounded-lg text-bobby-muted hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink flex items-center justify-center text-[14px] disabled:opacity-30', title: 'New session' }, '+')
      )
    ),
    React.createElement('div', { className: 'px-4 py-2.5 border-b', style: { borderColor: 'var(--bobby-sidebar-divider)' } },
      React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('span', { className: 'inline-block h-2 w-2 rounded-full', style: { background: busy ? 'var(--bobby-accent)' : status !== 'idle' ? 'var(--bobby-success)' : 'var(--bobby-border)' } }),
        React.createElement('span', { className: 'text-[12px] text-bobby-muted' }, busy ? 'Working...' : status === 'idle' ? 'Ready' : status)
      )
    ),
    React.createElement('div', { className: 'flex-1 overflow-y-auto px-2 py-3' },
      React.createElement('h2', { className: 'mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-bobby-faint' }, 'Sessions'),
      sessions.length === 0 && !hasContent && React.createElement('p', { className: 'px-2 text-[12px] text-bobby-faint' }, 'No sessions yet'),
      React.createElement('div', { className: 'space-y-0.5' },
        hasContent && React.createElement('button', {
          onClick: () => newSession(),
          className: 'w-full text-left truncate rounded-lg px-3 py-2 text-[12px] text-bobby-ink',
          style: { background: 'var(--bobby-sidebar-row-active)' }
        }, blocks.find(b => b.kind === 'user')?.text?.slice(0, 55) || 'Current session'),
        ...sessions.map(s => React.createElement('button', {
          key: s.id, onClick: () => switchSession(s.id),
          className: 'w-full text-left truncate rounded-lg px-3 py-2 text-[12px] text-bobby-ink hover:bg-bobby-sidebar-row-hover transition'
        }, s.title.slice(0, 55) + (s.title.length > 55 ? '...' : '')))
      )
    ),
    onThemeChange && React.createElement('div', { className: 'border-t px-3 py-2', style: { borderColor: 'var(--bobby-sidebar-divider)' } },
      React.createElement('button', { onClick: () => onThemeChange(theme === 'light' ? 'dark' : 'light'), className: 'w-full rounded-lg px-3 py-1.5 text-[12px] text-bobby-muted hover:text-bobby-ink hover:bg-bobby-sidebar-row-hover transition text-left' },
        theme === 'light' ? '🌙 Dark mode' : '☀️ Light mode')
    )
  );
}

function App() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('bobby-theme') as 'light' | 'dark') || 'light'; } catch { return 'light'; }
  });
  const [page, setPage] = React.useState<'chat' | 'write' | 'code' | 'plugins' | 'schedule' | 'claw' | 'settings'>('chat');
  const [lang, setLang2] = React.useState<'zh' | 'en'>('zh');
  const client = React.useMemo(() => resolveKernelClient(), []);

  React.useEffect(() => { document.documentElement.setAttribute('data-theme', theme); try { localStorage.setItem('bobby-theme', theme); } catch {} }, [theme]);
  React.useEffect(() => { setLang(lang); }, [lang]);

  const handleTheme = (t: 'light' | 'dark') => { setTheme(t); };
  const handlePage = (p: string) => { setPage(p as any); };

  let content = null;
  if (page === 'settings') content = React.createElement(Settings);
  else if (page === 'write') content = React.createElement(WriteMode, { onClose: () => setPage('chat') });
  else if (page === 'code') content = React.createElement(CodeMode, { onClose: () => setPage('chat') });
  else if (page === 'plugins') content = React.createElement(PluginMarketplace);
  else if (page === 'schedule') content = React.createElement(ScheduleTasks);
  else if (page === 'claw') content = React.createElement(ClawMode, { onClose: () => setPage('chat') });
  else content = React.createElement(React.Fragment, null,
    React.createElement(Workspace, { kernelClient: client ? client as any : undefined, theme, onThemeChange: handleTheme }),
    React.createElement(RightPanel),
    React.createElement(ReviewPanel)
  );

  return React.createElement('div', { className: 'flex h-screen w-screen overflow-hidden bg-bobby-main text-bobby-ink', style: { fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif" } },
    React.createElement(Sidebar, { theme, onThemeChange: handleTheme, onPage: handlePage }),
    React.createElement('main', { className: 'flex-1 min-w-0' }, content)
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(React.createElement(App));