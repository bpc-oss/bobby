import React from 'react';

import { getKernelClient } from '../kernel';
import { ChatProjectsView } from '../modes/ChatProjectsView';
import { EmptyState } from '../modes/EmptyState';
import { LoopPlaceholder } from '../modes/LoopPlaceholder';
import { getPlaceholders } from '../modes/placeholder-config';
import { RightPanel } from '../panels/RightPanel';
import { Settings } from '../screens/Settings';
import { useSessionStore } from '../store/session-store';
import { useUiStore } from '../store/ui-store';
import { SessionView } from '../workspace/SessionView';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';

function MainView(): JSX.Element {
  const lang = useUiStore((state) => state.lang);
  const mode = useUiStore((state) => state.mode);
  const view = useUiStore((state) => state.view);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);

  if (view === 'session') {
    return <SessionView sessionId={activeSessionId} mode={mode} />;
  }

  if (view === 'loop') {
    return <LoopPlaceholder />;
  }

  if (view === 'projects' && mode === 'chat') {
    return <ChatProjectsView />;
  }

  if (view === 'settings') {
    return <Settings />;
  }

  const placeholder = getPlaceholders(lang)[view];
  return (
    <EmptyState
      glyph={placeholder.glyph}
      title={placeholder.title}
      desc={placeholder.desc}
      tag={placeholder.tag}
    >
      {placeholder.children}
    </EmptyState>
  );
}

export function AppShell(): JSX.Element {
  const setSessions = useSessionStore((state) => state.setSessions);
  const applyGuiEvent = useSessionStore((state) => state.applyGuiEvent);
  const rightPanelOpen = useUiStore((state) => state.rightPanelOpen);

  React.useEffect(() => {
    const client = getKernelClient();
    void client.listSessions('chat').then(setSessions);
    void client.listSessions('code').then(setSessions);
    return client.onEvent(applyGuiEvent);
  }, [setSessions, applyGuiEvent]);

  return (
    <div className="app-shell">
      <div className={`app-grid ${rightPanelOpen ? 'right-open' : 'right-closed'}`}>
        <TitleBar />
        <Sidebar />
        <main className="main">
          <MainView />
        </main>
        <RightPanel />
        <StatusBar kernelConnected model="FLASH" contextPct={0} mock />
      </div>
    </div>
  );
}
