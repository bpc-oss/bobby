import React from 'react';

import type { Usage } from '../kernel/client';
import { useUiStore } from '../store/ui-store';

function fmtTok(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(value);
}

export function UsageBar({ usage }: { usage: Usage }): JSX.Element {
  const lang = useUiStore((state) => state.lang);
  const cache = usage.cacheHitRate < 0 ? '-' : `${Math.round(usage.cacheHitRate * 100)}%`;
  const tokens =
    usage.inputTokens === 0 && usage.outputTokens === 0
      ? lang === 'zh'
        ? '0 令牌'
        : '0 TOK'
      : lang === 'zh'
        ? `输入 ${fmtTok(usage.inputTokens)} / 输出 ${fmtTok(usage.outputTokens)}`
        : `IN ${fmtTok(usage.inputTokens)} / OUT ${fmtTok(usage.outputTokens)}`;
  const amount = `¥${usage.cny.toFixed(2)}`;

  return (
    <div className="costbar">
      <span>{lang === 'zh' ? `缓存 ${cache}` : `CACHE ${cache}`}</span>
      <span>{tokens}</span>
      <span>{amount}</span>
    </div>
  );
}
