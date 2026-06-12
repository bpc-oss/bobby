import React from 'react';
import { createRoot } from 'react-dom/client';
import { setLang } from './lib/i18n';
import { makeKernelClient } from './ipc/contract';
import { useChatStore } from './store/chat-store';
import { Wizard } from './screens/Wizard';
import { Workspace } from './screens/Workspace';
import { Settings } from './screens/Settings';
import { SessionToolDock, type DockTab, type DockTabRequest } from './components/SessionToolDock';
import { Sidebar } from './components/Sidebar';
import { PluginMarketplace } from './screens/PluginMarketplace';
import { Agents } from './screens/Agents';
import { Commands } from './screens/Commands';
import { ScheduleTasks } from './screens/ScheduleTasks';
import { ProjectHome } from './screens/ProjectHome';
import { History } from './screens/History';
import type { OnboardingStatus } from './ipc/contract';
import './styles/tokens.css';

type AppPage = 'chat' | 'history' | 'plugins' | 'agents' | 'commands' | 'schedule' | 'settings';
type AppCommand = { type: 'new-task' } | { type: 'open-page'; page: AppPage; sessionId?: string };
type AppNavigateEvent = CustomEvent<{ page?: AppPage; sessionId?: string; dockTab?: DockTab }>;

const ONBOARDING_COMPLETE_KEY = 'bobby-onboarding-complete';
const LAST_ACTIVE_SESSION_KEY = 'bobby-last-active-session';

function resolveKernelClient() {
  if (typeof window === 'undefined') return null;
  if (window.bobby !== undefined) return makeKernelClient();
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

function saveLastActiveSessionId(sessionId: string | null): void {
  try {
    if (sessionId) {
      localStorage.setItem(LAST_ACTIVE_SESSION_KEY, sessionId);
    } else {
      localStorage.removeItem(LAST_ACTIVE_SESSION_KEY);
    }
  } catch {
    // ignore localStorage write failures
  }
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
  const [dockTabRequest, setDockTabRequest] = React.useState<DockTabRequest | null>(null);
  const [lang] = React.useState<'zh' | 'en'>('zh');
  const [setupStatus, setSetupStatus] = React.useState<OnboardingStatus | null>(null);
  const [setupLoading, setSetupLoading] = React.useState(false);
  const [onboardingComplete, setOnboardingComplete] = React.useState(() => readOnboardingComplete());
  const [client, setClient] = React.useState(() => resolveKernelClient());
  const currentProject = useChatStore((s) => s.currentProject);
  const recentProjects = useChatStore((s) => s.recentProjects);
  const loadProjectState = useChatStore((s) => s.loadProjectState);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const openProject = useChatStore((s) => s.openProject);
  const selectProject = useChatStore((s) => s.selectProject);
  const newSession = useChatStore((s) => s.newSession);
  const resumeSession = useChatStore((s) => s.resumeSession);
  const activeSessionId = useChatStore((s) => s.activeSessionId);

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
    if (client) return;
    const timer = window.setInterval(() => {
      const nextClient = resolveKernelClient();
      if (nextClient) {
        setClient(nextClient);
        window.clearInterval(timer);
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [client]);

  React.useEffect(() => {
    void loadProjectState();
    void loadSessions();
  }, [loadProjectState, loadSessions]);

  React.useEffect(() => {
    saveLastActiveSessionId(activeSessionId);
  }, [activeSessionId]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.bobby?.onAppCommand) return;
    const handleAppCommand = (command: AppCommand) => {
      if (command.type === 'new-task') {
        setPage('chat');
        newSession();
        return;
      }
      if (command.type === 'open-page') {
        if (command.sessionId) {
          resumeSession(command.sessionId);
        }
        setPage(command.page);
      }
    };
    return window.bobby.onAppCommand(handleAppCommand as unknown as (command: { type: string }) => void);
  }, [newSession]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleNavigate = (event: Event) => {
      const detail = (event as AppNavigateEvent).detail ?? {};
      if (detail.sessionId) {
        resumeSession(detail.sessionId);
      }
      if (detail.page) {
        setPage(detail.page);
      }
      if (detail.dockTab) {
        setDockTabRequest({ id: detail.dockTab, nonce: Date.now() });
      }
    };
    window.addEventListener('bobby:navigate', handleNavigate);
    return () => {
      window.removeEventListener('bobby:navigate', handleNavigate);
    };
  }, [resumeSession]);

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
  else if (page === 'commands') content = <Commands />;
  else if (page === 'schedule') content = <ScheduleTasks />;
  else {
    content = (
      <div data-testid="chat-workbench" className="flex h-full min-w-0 overflow-hidden">
        <section className="min-w-0 flex-1">
          <Workspace kernelClient={client ?? undefined} theme={theme} onThemeChange={handleTheme} />
        </section>
        <SessionToolDock requestedTab={dockTabRequest} />
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-bobby-main text-bobby-ink"
      style={{ fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif" }}
    >
      <Sidebar page={page} theme={theme} onThemeChange={handleTheme} onPage={setPage} onNewSession={() => setPage('chat')} />
      <main className="h-full min-w-0 flex-1 overflow-hidden">{content}</main>
    </div>
  );
}

type BobbyRootElement = HTMLElement & { __bobbyRoot?: ReturnType<typeof createRoot> };

const root = document.getElementById('root') as BobbyRootElement | null;
if (root) {
  root.__bobbyRoot ??= createRoot(root);
  root.__bobbyRoot.render(<App />);
}
