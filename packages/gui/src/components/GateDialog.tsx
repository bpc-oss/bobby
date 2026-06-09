import React from 'react';
import type { GateDecision } from '@bobby/shared';

import { t } from '../lib/i18n';

interface GateDialogProps {
  reason: string;
  onDecide: (decision: GateDecision) => void;
}

export function GateDialog({ reason, onDecide }: GateDialogProps): JSX.Element {
  return (
    <section role="dialog" className="gate-dialog">
      <h3>执行前需你确认</h3>
      <p>{`系统检测到需要继续下面操作：${reason}`}</p>
      <p className="muted">为了安全起见，需要你确认是否允许。</p>
      <div className="gate-buttons">
        <button className="gate-allow" onClick={() => onDecide('allow')}>
          {t('allow')}
        </button>
        <button className="gate-always" onClick={() => onDecide('always')}>
          Always
        </button>
        <button className="gate-deny" onClick={() => onDecide('deny')}>
          {t('deny')}
        </button>
      </div>
    </section>
  );
}
