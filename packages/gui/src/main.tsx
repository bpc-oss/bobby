import React from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, CalendarClock, Clock3, MessageSquare, Plus, Puzzle, Settings2 } from 'lucide-react';
import { setLang } from './lib/i18n';
import { makeKernelClient } from './ipc/contract';
import { useChatStore } from './store/chat-store';
import { Wizard } from './screens/Wizard';
import { Workspace } from './screens/Workspace';
import { Settings } from './screens/Settings';
import { SessionToolDock } from './components/SessionToolDock';
import { PluginMarketplace } from './screens/PluginMarketplace';
import { Agents } from './screens/Agents';
import { ScheduleTasks } from './screens/ScheduleTasks';
import { ClawMode } from './screens/ClawMode';
import { ProjectHome } from './screens/ProjectHome';
import { History } from './screens/History';
import type { OnboardingStatus } from './ipc/contract';
import './styles/tokens.css';

type AppPage = 'chat' | 'history' | 'plugins' | 'agents' | 'schedule' | 'claw' | 'settings';

const ONBOARDING_COMPLETE_KEY = 'bobby-onboarding-complete';

function resolveKernelClient() {
  if (typeof window === 'undefined') return null;
  if ((window as any).bobby !== undefined) return makeKernelClient();
  return null;
}

function readOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveOnboardingComplete(value: boolean): void {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, String(value));
  } catch {
    // localStorage can be unavailable in tests or locked-down shells.
  }
}

function Sidebar({
  theme,
  onThemeChange,
  onPage
}: {
  theme: string;
  onThemeChange: (t: 'light' | 'dark') => void;
  onPage: (p: AppPage) => void;
}) {
  const threads = useChatStore((s) => s.threads);
  const busy = useChatStore((s) => s.busy);
  const status = useChatStore((s) => s.status);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const newSession = useChatStore((s) => s.newSession);
  const resumeSession = useChatStore((s) => s.switchSession);
  const switchSession = useChatStore((s) => s.switchSession);
  const tasks = React.useMemo(() => Object.values(threads).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()), [threads]);
  const activeThread = activeSessionId ? threads[activeSessionId] : null;

  const toolbar = [
    { key: 'plugins', title: 'Plugins', icon: Puzzle, onClick: () => onPage('plugins') },
    { key: 'agents', title: 'Agents', icon: Bot, onClick: () => onPage('agents') },
    { key: 'schedule', title: 'Automations', icon: CalendarClock, onClick: () => onPage('schedule') },
    { key: 'history', title: 'History', icon: Clock3, onClick: () => onPage('history') },
    { key: 'chat', title: 'Chat', icon: MessageSquare, onClick: () => onPage('chat') },
    { key: 'settings', title: 'Settings', icon: Settings2, onClick: () => onPage('settings') }
  ];

  return (
    <aside
      className="flex h-full w-[260px] flex-col border-r"
      style={{ background: 'var(--bobby-bg-sidebar)', borderColor: 'var(--bobby-sidebar-border)' }}
    >
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--bobby-sidebar-divider)' }}>
        <h1 className="select-none text-[13px] font-bold text-bobby-ink">Bobby</h1>
        <div className="flex items-center gap-1">
          {toolbar.map(({ key, title, icon: Icon, onClick }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[14px] text-bobby-muted hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
              title={title}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <button
            type="button"
            onClick={newSession}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[14px] text-bobby-muted hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
            title="New task thread"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-b px-4 py-2.5" style={{ borderColor: 'var(--bobby-sidebar-divider)' }}>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: activeThread?.status === 'running' || busy ? 'var(--bobby-accent)' : activeThread?.status && activeThread.status !== 'idle' ? 'var(--bobby-success)' : 'var(--bobby-border)' }}
          />
          <span className="text-[12px] text-bobby-muted">{activeThread?.status === 'running' || busy ? 'Working...' : activeThread?.status === 'idle' || status === 'idle' ? 'Ready' : activeThread?.status ?? status}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <h2 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-bobby-faint">Tasks</h2>
        {tasks.length === 0 && <p className="px-2 text-[12px] text-bobby-faint">No tasks yet</p>}
        <div className="space-y-0.5">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => {
                if (task.id !== activeSessionId) switchSession(task.id);
              }}
              className="flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left text-[12px] text-bobby-ink transition hover:bg-bobby-sidebar-row-hover"
              style={task.id === activeSessionId ? { background: 'var(--bobby-sidebar-row-active)' } : undefined}
              title={task.taskId ? `${task.title} / ${task.taskId}` : task.title}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {task.title.slice(0, 55)}
                  {task.title.length > 55 ? '...' : ''}
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: task.status === 'running' ? 'var(--bobby-accent-soft)' : task.status === 'failed' ? 'var(--bobby-danger-soft)' : task.status === 'blocked' ? 'rgba(217, 119, 6, 0.16)' : 'var(--bobby-hover)', color: task.status === 'running' ? 'var(--bobby-accent)' : task.status === 'failed' ? 'var(--bobby-danger)' : task.status === 'blocked' ? '#d97706' : 'var(--bobby-muted)' }}>
                  {task.status}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-bobby-faint">
                <span className="truncate">{task.projectDir ? task.projectDir.split(/[\\/]/).filter(Boolean).at(-1) ?? task.projectDir : 'No project'}</span>
                <span className="shrink-0">{task.taskId ?? task.id}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t px-3 py-2" style={{ borderColor: 'var(--bobby-sidebar-divider)' }}>
        <button
          type="button"
          onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
          className="w-full rounded-lg px-3 py-1.5 text-left text-[12px] text-bobby-muted transition hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
        >
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
      </div>
    </aside>
  );
}

export function App() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('bobby-theme') as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });
  const [page, setPage] = React.useState<AppPage>('chat');
  const [lang, setLangState] = React.useState<'zh' | 'en'>('zh');
  const [setupStatus, setSetupStatus] = React.useState<OnboardingStatus | null>(null);
  const [setupLoading, setSetupLoading] = React.useState(false);
  const [onboardingComplete, setOnboardingComplete] = React.useState(() => readOnboardingComplete());
  const client = React.useMemo(() => resolveKernelClient(), []);
  const currentProject = useChatStore((s) => s.currentProject);
  const recentProjects = useChatStore((s) => s.recentProjects);
  const loadProjectState = useChatStore((s) => s.loadProjectState);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const openProject = useChatStore((s) => s.openProject);
  const selectProject = useChatStore((s) => s.selectProject);
  const newSession = useChatStore((s) => s.newSession);
  const resumeSession = useChatStore((s) => s.switchSession);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('bobby-theme', theme);
    } catch {
      // ignore localStorage write failures
    }
  }, [theme]);

  React.useEffect(() => {
    setLang(lang);
  }, [lang]);

  React.useEffect(() => {
    void loadProjectState();
    void loadSessions();
  }, [loadProjectState, loadSessions]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.bobby?.onAppCommand) return;
    return window.bobby.onAppCommand((command) => {
      if (command.type === 'new-task') {
        setPage('chat');
        newSession();
      }
    });
  }, [newSession]);

  React.useEffect(() => {
    if (!client?.getSetupStatus) {
      setSetupStatus(null);
      setSetupLoading(false);
      return;
    }

    let active = true;
    setSetupLoading(true);
    void client
      .getSetupStatus()
      .then((status) => {
        if (!active) return;
        setSetupStatus(status);
        setSetupLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSetupStatus(null);
        setSetupLoading(false);
      });

    return () => {
      active = false;
    };
  }, [client]);

  const handleTheme = React.useCallback((nextTheme: 'light' | 'dark') => {
    setTheme(nextTheme);
  }, []);

  const handleRefreshSetup = React.useCallback(() => {
    if (!client?.getSetupStatus) return;
    setSetupLoading(true);
    void client
      .getSetupStatus()
      .then((status) => {
        setSetupStatus(status);
        setSetupLoading(false);
      })
      .catch(() => {
        setSetupLoading(false);
      });
  }, [client]);

  const handleStartWorkspace = React.useCallback(() => {
    setOnboardingComplete(true);
    saveOnboardingComplete(true);
  }, []);

  const handleOpenQuickstart = React.useCallback(() => {
    void client?.openQuickstart?.();
  }, [client]);

  const setupReady = Boolean(setupStatus?.hasKey && setupStatus?.hasCapabilities);
  const showOnboarding = Boolean(client) && (!onboardingComplete || !setupReady || setupLoading);

  if (showOnboarding) {
    return (
      <div
        className="flex h-screen w-screen overflow-hidden bg-bobby-main text-bobby-ink"
        style={{ fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif" }}
      >
        <Wizard
          status={setupStatus}
          loading={setupLoading}
          onRefresh={handleRefreshSetup}
          onStart={handleStartWorkspace}
          onOpenQuickstart={handleOpenQuickstart}
        />
      </div>
    );
  }

  const hasProjectRuntime = typeof window !== 'undefined' && typeof window.bobby?.openProject === 'function';

  if (client && hasProjectRuntime && !currentProject) {
    return (
      <div
        className="flex h-screen w-screen overflow-hidden bg-bobby-main text-bobby-ink"
        style={{ fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif" }}
      >
        <ProjectHome projects={recentProjects} onOpenProject={() => void openProject()} onSelectProject={(path) => void selectProject(path)} />
      </div>
    );
  }

  let content: React.ReactNode = null;
  if (page === 'settings') content = <Settings />;
  else if (page === 'history') content = <History onResumeTask={(sessionId) => {
    resumeSession(sessionId);
    setPage('chat');
  }} />;
  else if (page === 'plugins') content = <PluginMarketplace />;
  else if (page === 'agents') content = <Agents />;
  else if (page === 'schedule') content = <ScheduleTasks />;
  else if (page === 'claw') content = <ClawMode onClose={() => setPage('chat')} />;
  else {
    content = (
      <div data-testid="chat-workbench" className="flex h-full min-w-0 overflow-hidden">
        <section className="min-w-0 flex-1">
          <Workspace kernelClient={client ? (client as any) : undefined} theme={theme} onThemeChange={handleTheme} />
        </section>
        <SessionToolDock />
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-bobby-main text-bobby-ink"
      style={{ fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif" }}
    >
      <Sidebar theme={theme} onThemeChange={handleTheme} onPage={setPage} />
      <main className="h-full min-w-0 flex-1 overflow-hidden">{content}</main>
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
