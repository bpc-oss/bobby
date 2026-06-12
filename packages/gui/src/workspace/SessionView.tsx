import React from 'react';

import { getKernelClient } from '../kernel';
import { emptyUsage } from '../kernel/client';
import { useSessionStore } from '../store/session-store';
import { useUiStore } from '../store/ui-store';
import { Composer } from './Composer';
import { SummaryBar } from './SummaryBar';
import { TimelineCard } from './TimelineCards';
import { UsageBar } from './UsageBar';

const EMPTY_TIMELINE = [] as const;
const EMPTY_PLAN = [] as const;
const EMPTY_USAGE = emptyUsage();

function SessionHeader({
  title,
  branch,
  summaryOpen,
  onToggle
}: {
  title: string;
  branch?: string;
  summaryOpen: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <div className="ws-top">
      <span className="ws-title">{title}</span>
      {branch && <span className="git-chip">⎇ {branch}</span>}
      <button className={`summary-toggle ${summaryOpen ? 'open' : ''}`} onClick={onToggle}>
        ▻ 摘要
      </button>
    </div>
  );
}

export function SessionView({ sessionId }: { sessionId: string }): JSX.Element {
  const session = useSessionStore((state) => state.sessions[sessionId]);
  const timeline = useSessionStore((state) => state.timelines[sessionId]);
  const usage = useSessionStore((state) => state.usages[sessionId]);
  const plan = useSessionStore((state) => state.plans[sessionId]);
  const currentStepId = useSessionStore((state) => state.currentStepIds[sessionId]);
  const pendingGate = useSessionStore((state) => state.pendingGates[sessionId]);
  const addUserMessage = useSessionStore((state) => state.addUserMessage);
  const toggleSummary = useUiStore((state) => state.toggleSummary);
  const summaryOpen = useUiStore((state) => state.summaryOpen);

  const handleSubmit = (input: string): void => {
    addUserMessage(sessionId, input);
    void getKernelClient().startTask(sessionId, input);
  };

  const handleGate = (gateId: string, decision: 'allow' | 'deny'): void => {
    void getKernelClient().approveGate(sessionId, gateId, decision);
  };

  return (
    <div className="session-view">
      <SessionHeader
        title={session?.title ?? 'New Chat'}
        branch={session?.branch}
        summaryOpen={summaryOpen}
        onToggle={toggleSummary}
      />
      <SummaryBar steps={plan ?? EMPTY_PLAN} currentStepId={currentStepId} />
      <div className="stream">
        {(timeline ?? EMPTY_TIMELINE).map((item, index) => (
          <TimelineCard
            key={index}
            item={item}
            onGateDecision={handleGate}
            gatePending={
              item.kind === 'kernel' &&
              item.event.type === 'gate_request' &&
              pendingGate?.gateId === item.event.gateId
            }
          />
        ))}
      </div>
      <div className="composer-wrap">
        <Composer onSubmit={handleSubmit} disabled={Boolean(pendingGate)} />
        <UsageBar usage={usage ?? EMPTY_USAGE} />
      </div>
    </div>
  );
}
