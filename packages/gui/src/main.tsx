import React from 'react';
import { createRoot } from 'react-dom/client';
import { setLang } from './lib/i18n';
import { makeKernelClient } from './ipc/contract';
import { useChatStore } from './store/chat-store';
import { Wizard } from './screens/Wizard';
import { Workspace } from './screens/Workspace';
import { Settings } from './screens/Settings';
import { SessionToolDock } from './components/SessionToolDock';
import { Sidebar } from './components/Sidebar';
import { PluginMarketplace } from './screens/PluginMarketplace';
import { Agents } from './screens/Agents';
import { Commands } from './screens/Commands';
import { ScheduleTasks } from './screens/ScheduleTasks';
import { ClawMode } from './screens/ClawMode';
import { ProjectHome } from './screens/ProjectHome';
import { History } from './screens/History';
import type { OnboardingStatus } from './ipc/contract';
import './styles/tokens.css';

type AppPage = 'chat' | 'history' | 'plugins' | 'agents' | 'commands' | 'schedule' | 'claw' | 'settings';

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
  else if (page === 'commands') content = <Commands />;
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
      <Sidebar theme={theme} onThemeChange={handleTheme} onPage={setPage} onNewSession={() => setPage('chat')} />
      <main className="h-full min-w-0 flex-1 overflow-hidden">{content}</main>
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
