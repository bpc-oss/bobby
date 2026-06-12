import React from 'react';

import { getKernelClient } from '../kernel';
import { EmptyState } from '../modes/EmptyState';
import { LoopPlaceholder } from '../modes/LoopPlaceholder';
import { PLACEHOLDERS } from '../modes/placeholder-config';
import { RightPanel } from '../panels/RightPanel';
import { useSessionStore } from '../store/session-store';
import { useUiStore } from '../store/ui-store';
import { SessionView } from '../workspace/SessionView';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';

function SessionEmpty({ mode }: { mode: 'chat' | 'code' }): JSX.Element {
  const title = mode === 'chat' ? 'New Chat' : 'New Session';
  return (
    <EmptyState
      glyph="◉"
      title={title}
      desc={`点击左侧 ${title} 创建 mock 会话。`}
      tag="P1"
    />
  );
}

function MainView(): JSX.Element {
  const mode = useUiStore((state) => state.mode);
  const view = useUiStore((state) => state.view);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);

  if (view === 'session') {
    return activeSessionId ? <SessionView sessionId={activeSessionId} /> : <SessionEmpty mode={mode} />;
  }

  if (view === 'loop') {
    return <LoopPlaceholder />;
  }

  const placeholder = PLACEHOLDERS[view];
  return (
    <EmptyState
      glyph={placeholder.glyph}
      title={placeholder.title}
      desc={placeholder.desc}
      tag={placeholder.tag}
    />
  );
}

export function AppShell(): JSX.Element {
  const setSessions = useSessionStore((state) => state.setSessions);
  const applyGuiEvent = useSessionStore((state) => state.applyGuiEvent);

  React.useEffect(() => {
    const client = getKernelClient();
    void client.listSessions('chat').then(setSessions);
    void client.listSessions('code').then(setSessions);
    return client.onEvent(applyGuiEvent);
  }, [setSessions, applyGuiEvent]);

  return (
    <div className="app-grid">
      <TitleBar projectName="bobby" />
      <Sidebar />
      <main className="main">
        <MainView />
      </main>
      <RightPanel />
      <StatusBar kernelConnected model="FLASH" contextPct={0} mock />
    </div>
  );
}
