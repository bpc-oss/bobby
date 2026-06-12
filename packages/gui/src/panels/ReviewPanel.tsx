import React from 'react';

import type { TimelineItem } from '../store/session-store';
import { useSessionStore } from '../store/session-store';

function getEvidenceItems(timeline: TimelineItem[]) {
  return timeline.flatMap((item) =>
    item.kind === 'kernel' && item.event.type === 'evidence_produced' ? [item.event.evidence] : []
  );
}

export function ReviewPanel(): JSX.Element {
  const activeId = useSessionStore((state) => state.activeSessionId);
  const timeline = useSessionStore((state) => (activeId ? state.timelines[activeId] : undefined));

  const evidences = getEvidenceItems(timeline ?? []);
  const diffs = evidences.filter((evidence) => evidence.evidenceType === 'file_diff');

  if (evidences.length === 0) {
    return <div className="rp-empty">暂无变更与证据 — 会话产生 file_diff / 证据后显示</div>;
  }

  return (
    <div>
      <div className="rp-sec-h">CHANGES · {diffs.length}</div>
      {diffs.map((evidence, index) => (
        <div className="file-row" key={`${index}-${String(evidence.acId)}`}>
          <span className="m M">M</span>
          <span>{String((evidence.payload as { path?: unknown }).path ?? '')}</span>
        </div>
      ))}
      <div className="rp-sec-h">EVIDENCE · {evidences.length}</div>
      {evidences.map((evidence, index) => (
        <div className="evid-row" key={`${index}-${String(evidence.acId)}`}>
          <span className="ck">✓</span>
          <span>{evidence.evidenceType}</span>
        </div>
      ))}
      <button className="review-btn" disabled title="P3 接入">
        ◎ 用 Pro 复核本次变更
      </button>
    </div>
  );
}
