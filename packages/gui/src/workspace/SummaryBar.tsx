import type { PlanStep } from '@bobby/shared';
import React from 'react';

import { useUiStore } from '../store/ui-store';

interface SummaryBarProps {
  steps: PlanStep[];
  currentStepId?: string;
}

export function SummaryBar({ steps, currentStepId }: SummaryBarProps): JSX.Element {
  const open = useUiStore((state) => state.summaryOpen);

  return (
    <div className={`summary ${open ? 'open' : ''}`}>
      {steps.length === 0 && <div className="step">暂无计划，任务开始后显示步骤</div>}
      {steps.map((step) => (
        <div key={step.id} className={`step ${step.id === currentStepId ? 'cur' : ''}`}>
          <span className="sn">{step.id === currentStepId ? '●' : '○'}</span>
          {step.desc}
        </div>
      ))}
    </div>
  );
}
