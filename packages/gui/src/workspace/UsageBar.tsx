import React from 'react';

import type { Usage } from '../kernel/client';

function fmtTok(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value);
}

export function UsageBar({ usage }: { usage: Usage }): JSX.Element {
  const cache = usage.cacheHitRate < 0 ? '—' : `${Math.round(usage.cacheHitRate * 100)}%`;
  const tokens =
    usage.inputTokens === 0 && usage.outputTokens === 0
      ? '0 TOK'
      : `IN ${fmtTok(usage.inputTokens)} / OUT ${fmtTok(usage.outputTokens)}`;
  const text = `CACHE ${cache} · ${tokens} · ¥${usage.cny.toFixed(2)}`;

  return <div className="costbar">{text}</div>;
}
