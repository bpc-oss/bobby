import React from 'react';

import type { TimelineItem } from '../store/session-store';

interface TimelineCardProps {
  item: TimelineItem;
  onGateDecision: (gateId: string, decision: 'allow' | 'deny') => void;
  gatePending?: boolean;
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
    return (
      <div className="card tool">
        <div className="ch">
          ⚙ 工具调用 <span className="tag">{event.tool}</span>
        </div>
      </div>
    );
  }

  if (event.type === 'gate_request') {
    return (
      <div className="card gate">
        <div className="ch">
          ✦ 闸口审批 <span className="tag">gate</span>
        </div>
        <pre>{event.reason}</pre>
        {gatePending ? (
          <div className="gate-btns">
            <button className="allow" onClick={() => onGateDecision(event.gateId, 'allow')}>
              允许
            </button>
            <button className="deny" onClick={() => onGateDecision(event.gateId, 'deny')}>
              拒绝
            </button>
          </div>
        ) : (
          <div className="gate-done">✓ 已决策 · 已记录</div>
        )}
      </div>
    );
  }

  if (event.type === 'evidence_produced') {
    return (
      <div className="card evid">
        <div className="ch">
          ⊕ 证据 <span className="tag">{event.evidence.evidenceType}</span>
        </div>
        <pre>{JSON.stringify(event.evidence.payload, null, 2)}</pre>
      </div>
    );
  }

  if (event.type === 'verdict') {
    return (
      <div className="card verdict">
        <div className="ch">
          🛰 复核 <span className="tag">{event.verdict.oracleTier}</span>
          <span className="tag">{event.verdict.result}</span>
        </div>
        {event.verdict.detail && <pre>{event.verdict.detail}</pre>}
      </div>
    );
  }

  if (event.type === 'error') {
    return (
      <div className="card gate">
        <div className="ch">⚠ 错误</div>
        <pre>{event.message}</pre>
      </div>
    );
  }

  return null;
}
