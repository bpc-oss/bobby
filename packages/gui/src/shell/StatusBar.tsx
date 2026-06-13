import React from 'react';

import { useUiStore } from '../store/ui-store';

interface StatusBarProps {
  kernelConnected: boolean;
  model: string;
  contextPct: number;
  mock?: boolean;
}

function StatusChip({ className, children }: { className?: string; children: React.ReactNode }): JSX.Element {
  return <span className={`status-chip ${className ?? ''}`.trim()}>{children}</span>;
}

export function StatusBar({
  kernelConnected,
  model,
  contextPct,
  mock = false
}: StatusBarProps): JSX.Element {
  const lang = useUiStore((state) => state.lang);

  return (
    <div className="status">
      <StatusChip className="status-chip-primary">
        <span className="led">●</span>
        <span>{kernelConnected ? (lang === 'zh' ? '内核已连接' : 'Kernel connected') : lang === 'zh' ? '内核离线' : 'Kernel offline'}</span>
      </StatusChip>

      <StatusChip>
        <span className="led status-led-soft">◌</span>
        <span>DeepSeek / {model}</span>
      </StatusChip>

      <StatusChip className="status-context">
        <span className="status-label">{lang === 'zh' ? '上下文' : 'CTX'}</span>
        <span className="ctx-meter">
          <i style={{ width: `${contextPct}%` }} />
        </span>
        <span className="status-value">{contextPct}%</span>
      </StatusChip>

      {mock ? <StatusChip>{lang === 'zh' ? '模拟模式' : 'Mock mode'}</StatusChip> : null}
      {mock ? <StatusChip className="status-update">{lang === 'zh' ? 'v0.1.1 更新' : 'v0.1.1 Update'}</StatusChip> : null}
    </div>
  );
}
