import React from 'react';

import { useUiStore } from '../store/ui-store';
import { Composer } from './Composer';
import { SummaryBar } from './SummaryBar';
import { UsageBar } from './UsageBar';

interface SessionViewProps {
  title: string;
  branch?: string;
}

export function SessionView({ title, branch }: SessionViewProps): JSX.Element {
  const toggleSummary = useUiStore((state) => state.toggleSummary);
  const summaryOpen = useUiStore((state) => state.summaryOpen);

  return (
    <div className="session-view">
      <div className="ws-top">
        <span className="ws-title">{title}</span>
        {branch && <span className="git-chip">⑂ {branch}</span>}
        <button className={`summary-toggle ${summaryOpen ? 'open' : ''}`} onClick={toggleSummary}>
          ▾ 摘要
        </button>
      </div>
      <SummaryBar steps={[]} />
      <div className="stream" />
      <div className="composer-wrap">
        <Composer onSubmit={() => undefined} />
        <UsageBar usage={{ inputTokens: 0, outputTokens: 0, cacheHitRate: -1, cny: 0 }} />
      </div>
    </div>
  );
}
