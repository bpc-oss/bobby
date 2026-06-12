import React from 'react';

import type { Usage } from '../kernel/client';

function fmtTok(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value);
}

export function UsageBar({ usage }: { usage: Usage }): JSX.Element {
  return (
    <div className="costbar">
      <span>
        CACHE <b>{usage.cacheHitRate < 0 ? '——' : `${Math.round(usage.cacheHitRate * 100)}%`}</b>
      </span>
      <span>
        IN {fmtTok(usage.inputTokens)} / OUT {fmtTok(usage.outputTokens)} TOK
      </span>
      <span>
        SESSION ≈<b>¥{usage.cny.toFixed(2)}</b>
      </span>
    </div>
  );
}
