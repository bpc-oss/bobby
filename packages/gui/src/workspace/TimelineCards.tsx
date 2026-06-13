import React from 'react';

import type { TimelineItem } from '../store/session-store';
import { useUiStore } from '../store/ui-store';

interface TimelineCardProps {
  item: TimelineItem;
  onGateDecision: (gateId: string, decision: 'allow' | 'deny') => void;
  gatePending?: boolean;
}

function ToolCard({ tool, lang }: { tool: string; lang: 'zh' | 'en' }): JSX.Element {
  return (
    <div className="card tool">
      <div className="ch">
        {lang === 'zh' ? '工具调用' : 'Tool call'} <span className="tag">{tool}</span>
      </div>
    </div>
  );
}

function GateCard({
  gateId,
  reason,
  pending,
  onGateDecision,
  lang
}: {
  gateId: string;
  reason: string;
  pending: boolean;
  onGateDecision: (gateId: string, decision: 'allow' | 'deny') => void;
  lang: 'zh' | 'en';
}): JSX.Element {
  return (
    <div className="card gate">
      <div className="ch">
        {lang === 'zh' ? '闸口审批' : 'Approval gate'} <span className="tag">gate</span>
      </div>
      <pre>{reason}</pre>
      {pending ? (
        <div className="gate-btns">
          <button className="allow" type="button" onClick={() => onGateDecision(gateId, 'allow')}>
            {lang === 'zh' ? '允许' : 'Allow'}
          </button>
          <button className="deny" type="button" onClick={() => onGateDecision(gateId, 'deny')}>
            {lang === 'zh' ? '拒绝' : 'Deny'}
          </button>
        </div>
      ) : (
        <div className="gate-done">{lang === 'zh' ? '已决策 · 已记录' : 'Decision recorded'}</div>
      )}
    </div>
  );
}

function EvidenceCard({
  evidenceType,
  payload,
  lang
}: {
  evidenceType: string;
  payload: unknown;
  lang: 'zh' | 'en';
}): JSX.Element {
  const prettyPayload =
    typeof payload === 'object' && payload && 'command' in payload
      ? [(payload as { command?: string; stdout?: string }).command, (payload as { stdout?: string }).stdout ?? '']
          .filter(Boolean)
          .join('\n')
      : JSON.stringify(payload, null, 2);

  return (
    <div className="card evid">
      <div className="ch">
        {lang === 'zh' ? '证据' : 'Evidence'} <span className="tag">{evidenceType}</span>
      </div>
      <pre>{prettyPayload}</pre>
    </div>
  );
}

function VerdictCard({
  oracleTier,
  result,
  detail,
  lang
}: {
  oracleTier: string;
  result: string;
  detail?: string;
  lang: 'zh' | 'en';
}): JSX.Element {
  return (
    <div className="card verdict">
      <div className="ch">
        {lang === 'zh' ? '复核' : 'Review'} <span className="tag">{oracleTier}</span>
        <span className="tag">{result}</span>
      </div>
      {detail ? <pre>{detail}</pre> : null}
    </div>
  );
}

function ErrorCard({ message, lang }: { message: string; lang: 'zh' | 'en' }): JSX.Element {
  return (
    <div className="card gate">
      <div className="ch">{lang === 'zh' ? '错误' : 'Error'}</div>
      <pre>{message}</pre>
    </div>
  );
}

export function TimelineCard({
  item,
  onGateDecision,
  gatePending = false
}: TimelineCardProps): JSX.Element | null {
  const lang = useUiStore((state) => state.lang);

  if (item.kind === 'user') {
    return <div className="msg user">{item.text}</div>;
  }

  const event = item.event;

  if (event.type === 'direct_answer') {
    return <div className="msg bot">{event.text}</div>;
  }

  if (event.type === 'tool_called') {
    return <ToolCard tool={event.tool} lang={lang} />;
  }

  if (event.type === 'gate_request') {
    return (
      <GateCard gateId={event.gateId} reason={event.reason} pending={gatePending} onGateDecision={onGateDecision} lang={lang} />
    );
  }

  if (event.type === 'evidence_produced') {
    return <EvidenceCard evidenceType={event.evidence.evidenceType} payload={event.evidence.payload} lang={lang} />;
  }

  if (event.type === 'verdict') {
    return <VerdictCard oracleTier={event.verdict.oracleTier} result={event.verdict.result} detail={event.verdict.detail} lang={lang} />;
  }

  if (event.type === 'error') {
    return <ErrorCard message={event.message} lang={lang} />;
  }

  return null;
}
