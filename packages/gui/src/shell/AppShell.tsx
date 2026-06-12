import React from 'react';

import { EmptyState } from '../modes/EmptyState';
import { LoopPlaceholder } from '../modes/LoopPlaceholder';
import { PLACEHOLDERS } from '../modes/placeholder-config';
import { RightPanel } from '../panels/RightPanel';
import { useUiStore } from '../store/ui-store';
import { SessionView } from '../workspace/SessionView';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';

function MainView(): JSX.Element {
  const mode = useUiStore((state) => state.mode);
  const view = useUiStore((state) => state.view);

  if (view === 'session') {
    return mode === 'chat' ? (
      <SessionView title="New Chat" />
    ) : (
      <SessionView title="New Session" branch="main" />
    );
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
