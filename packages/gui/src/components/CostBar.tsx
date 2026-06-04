import React from 'react';

interface CostBarProps {
  tokens: number;
  usd: number;
}

export function CostBar({ tokens, usd }: CostBarProps): JSX.Element {
  return (
    <section className="costbar">
      <span>成本用量（{tokens} token，估算 ¥{usd.toFixed(4)}）</span>
    </section>
  );
}
