import React, { useMemo, useState } from 'react';
import { AlertTriangle, Bug, ChevronDown, ChevronRight, Info, Shield } from 'lucide-react';
import { useChatStore, type ChatBlock } from '../store/chat-store';

type Finding = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  file: string;
  line?: number;
  message: string;
  category: string;
};

function analyzeBlocks(blocks: ChatBlock[]): Finding[] {
  const findings: Finding[] = [];
  for (const b of blocks) {
    if (b.kind === 'evidence') {
      const payload = b.evidence.payload as Record<string, unknown>;
      if (b.evidence.evidenceType === 'command_output' && payload.exitCode !== 0) {
        findings.push({
          id: b.id,
          severity: 'critical',
          file: String(payload.path ?? 'command'),
          message: String(payload.stderr ?? 'Command failed'),
          category: 'Command'
        });
      }
    }
    if (b.kind === 'verdict' && b.result === 'fail') {
      findings.push({
        id: b.id,
        severity: 'critical',
        file: 'evidence',
        message: `${b.acId}: ${b.result}`,
        category: 'Verification'
      });
    }
    if (b.kind === 'error') {
      findings.push({
        id: b.id,
        severity: 'critical',
        file: 'system',
        message: b.message,
        category: 'Error'
      });
    }
  }
  return findings;
}

const icons = { critical: Shield, warning: AlertTriangle, info: Info };
const colors = { critical: 'var(--bobby-danger)', warning: '#f59e0b', info: 'var(--bobby-accent)' };
const bgColors = { critical: 'var(--bobby-danger-soft)', warning: 'rgba(245,158,11,0.12)', info: 'var(--bobby-accent-soft)' };

export function ReviewPanel() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const blocks = useChatStore((s) => s.blocks);
  const findings = useMemo(() => analyzeBlocks(blocks), [blocks]);
  const counts = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    warning: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length
  };

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpanded(next);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-20 flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium text-white shadow-lg transition hover:opacity-90"
        style={{ background: counts.critical > 0 ? 'var(--bobby-danger)' : 'var(--bobby-accent)' }}
      >
        <Bug className="h-4 w-4" />
        Review ({findings.length})
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-20 flex max-h-[500px] w-[420px] flex-col overflow-hidden rounded-2xl shadow-2xl"
      style={{ background: 'var(--bobby-surface-elevated)', border: '1px solid var(--bobby-border)' }}
    >
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-bobby-ink" />
          <span className="text-[13px] font-semibold text-bobby-ink">Code Review</span>
          {counts.critical > 0 && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--bobby-danger)' }}>{counts.critical}</span>}
          {counts.warning > 0 && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: '#f59e0b' }}>{counts.warning}</span>}
        </div>
        <button onClick={() => setOpen(false)} className="text-[18px] text-bobby-muted hover:text-bobby-ink" aria-label="Close review">x</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {findings.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-bobby-muted">
            No review findings from the current session.
          </div>
        )}
        {findings.map((finding) => {
          const Icon = icons[finding.severity];
          const isExpanded = expanded.has(finding.id);
          return (
            <div key={finding.id} className="border-b" style={{ borderColor: 'var(--bobby-border-muted)' }}>
              <button onClick={() => toggle(finding.id)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition hover:bg-bobby-hover">
                <Icon className="h-3.5 w-3.5" style={{ color: colors[finding.severity] }} />
                <span className="flex-1 text-[12px] font-medium text-bobby-ink">{finding.message}</span>
                <span className="text-[11px] text-bobby-faint">{finding.file}{finding.line ? `:${finding.line}` : ''}</span>
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-bobby-faint" /> : <ChevronRight className="h-3.5 w-3.5 text-bobby-faint" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-3 pt-0" style={{ background: bgColors[finding.severity] }}>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-medium" style={{ color: colors[finding.severity] }}>{finding.severity.toUpperCase()}</span>
                    <span className="text-bobby-muted">{finding.category}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-bobby-muted">{finding.message}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
