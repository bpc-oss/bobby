import React from 'react';

interface StatusBarProps {
  kernelConnected: boolean;
  model: string;
  contextPct: number;
  mock?: boolean;
}

export function StatusBar({
  kernelConnected,
  model,
  contextPct,
  mock = false
}: StatusBarProps): JSX.Element {
  return (
    <div className="status">
      <span>
        <span className="led">●</span> {kernelConnected ? 'KERNEL CONNECTED' : 'KERNEL OFFLINE'}
      </span>
      <span>
        <span className="led">●</span> DEEPSEEK · {model}
      </span>
      <span>
        CTX
        <span className="ctx-meter">
          <i style={{ width: `${contextPct}%` }} />
        </span>
        {contextPct}%
      </span>
      {mock && <span>MOCK MODE</span>}
    </div>
  );
}
