import React from 'react';

import type { PlanStep } from '@bobby/shared';

interface PlanViewProps {
  steps: PlanStep[];
}

export function PlanView({ steps }: PlanViewProps): JSX.Element {
  return (
    <section>
      <h2 className="screen-title">计划</h2>
      <p className="muted">系统将分解为可执行步骤。</p>
      {steps.length === 0 ? (
        <p className="muted">暂无计划数据，任务运行后会自动显示。</p>
      ) : (
        <ol className="plan-list">
          {steps.map((step) => (
            <li key={step.id}>
              <strong>{step.id}</strong> {step.desc}
              <div className="muted">
                满足 AC: {step.satisfiesAcIds.join('、')}
                {step.dependsOn.length > 0 ? `；依赖: ${step.dependsOn.join('、')}` : ''}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
