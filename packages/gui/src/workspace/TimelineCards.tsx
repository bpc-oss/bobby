import React from 'react';

import type { TimelineItem } from '../store/session-store';

interface TimelineCardProps {
  item: TimelineItem;
  onGateDecision: (gateId: string, decision: 'allow' | 'deny') => void;
  gatePending?: boolean;
}

function ToolCard({ tool }: { tool: string }): JSX.Element {
  return (
    <div className="card tool">
      <div className="ch">
        ⚙ 工具调用 <span className="tag">{tool}</span>
      </div>
    </div>
  );
}

function GateCard({
  gateId,
  reason,
  pending,
  onGateDecision
}: {
  gateId: string;
  reason: string;
  pending: boolean;
  onGateDecision: (gateId: string, decision: 'allow' | 'deny') => void;
}): JSX.Element {
  return (
    <div className="card gate">
      <div className="ch">
        ✦ 闸口审批 <span className="tag">gate</span>
      </div>
      <pre>{reason}</pre>
      {pending ? (
        <div className="gate-btns">
          <button className="allow" onClick={() => onGateDecision(gateId, 'allow')}>
            允许
          </button>
          <button className="deny" onClick={() => onGateDecision(gateId, 'deny')}>
            拒绝
          </button>
        </div>
      ) : (
        <div className="gate-done">✓ 已决策 · 已记录</div>
      )}
    </div>
  );
}

function EvidenceCard({
  evidenceType,
  payload
}: {
  evidenceType: string;
  payload: unknown;
}): JSX.Element {
  return (
    <div className="card evid">
      <div className="ch">
        ◯ 证据 <span className="tag">{evidenceType}</span>
      </div>
      <pre>{JSON.stringify(payload, null, 2)}</pre>
    </div>
  );
}

function VerdictCard({
  oracleTier,
  result,
  detail
}: {
  oracleTier: string;
  result: string;
  detail?: string;
}): JSX.Element {
  return (
    <div className="card verdict">
      <div className="ch">
        🶶 复核 <span className="tag">{oracleTier}</span>
        <span className="tag">{result}</span>
      </div>
      {detail && <pre>{detail}</pre>}
    </div>
  );
}

function ErrorCard({ message }: { message: string }): JSX.Element {
  return (
    <div className="card gate">
      <div className="ch">⚙ 错误</div>
      <pre>{message}</pre>
    </div>
  );
}

export function TimelineCard({
  item,
  onGateDecision,
  gatePending = false
}: TimelineCardProps): JSX.Element | null {
  if (item.kind === 'user') {
    return <div className="msg user">{item.text}</div>;
  }

  const event = item.event;

  if (event.type === 'direct_answer') {
    return <div className="msg bot">{event.text}</div>;
  }

  if (event.type === 'tool_called') {
    return <ToolCard tool={event.tool} />;
  }

  if (event.type === 'gate_request') {
    return (
      <GateCard
        gateId={event.gateId}
        reason={event.reason}
        pending={gatePending}
        onGateDecision={onGateDecision}
      />
    );
  }

  if (event.type === 'evidence_produced') {
    return <EvidenceCard evidenceType={event.evidence.evidenceType} payload={event.evidence.payload} />;
  }

  if (event.type === 'verdict') {
    return (
      <VerdictCard
        oracleTier={event.verdict.oracleTier}
        result={event.verdict.result}
        detail={event.verdict.detail}
      />
    );
  }

  if (event.type === 'error') {
    return <ErrorCard message={event.message} />;
  }

  return null;
}
