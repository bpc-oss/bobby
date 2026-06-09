import React from 'react';
import type { PlanStep } from '@bobby/shared';
import { Check, X, Pencil } from 'lucide-react';

interface PlanViewProps {
  steps: PlanStep[];
  onDecision?: (decision: 'approve' | 'reject' | 'edit') => void;
}

export function PlanView({ steps, onDecision }: PlanViewProps): JSX.Element {
  if (steps.length === 0) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--bobby-surface-card)', border: '1px solid var(--bobby-border)' }}>
        <p className="text-[13px] text-bobby-muted">No plan data yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bobby-surface-card)', border: '1px solid var(--bobby-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--bobby-border-muted)', background: 'var(--bobby-surface-elevated)' }}>
        <h3 className="text-[13px] font-semibold text-bobby-ink">Plan ({steps.length} steps)</h3>
        {onDecision && (
          <div className="flex items-center gap-2">
            <button onClick={() => onDecision('edit')}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-bobby-muted hover:text-bobby-ink hover:bg-bobby-hover transition">
              <Pencil className="w-3.5 h-3.5" />Edit
            </button>
            <button onClick={() => onDecision('reject')}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium hover:opacity-90 transition"
              style={{ background: 'var(--bobby-danger-soft)', color: 'var(--bobby-danger)' }}>
              <X className="w-3.5 h-3.5" />Reject
            </button>
            <button onClick={() => onDecision('approve')}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition"
              style={{ background: 'var(--bobby-success)' }}>
              <Check className="w-3.5 h-3.5" />Approve
            </button>
          </div>
        )}
      </div>

      {/* Steps */}
      <ul className="divide-y" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        {steps.map((step, i) => (
          <li key={step.id} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: 'var(--bobby-accent-soft)', color: 'var(--bobby-accent)' }}>
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-bobby-ink">{step.id}: {step.desc}</div>
                <div className="mt-0.5 text-[11px] text-bobby-muted">
                  AC: {step.satisfiesAcIds.join(', ')}
                  {step.dependsOn.length > 0 && <span> · Depends on: {step.dependsOn.join(', ')}</span>}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
