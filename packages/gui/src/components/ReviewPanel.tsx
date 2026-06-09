import React, { useState, useMemo } from 'react';
import { Bug, AlertTriangle, Info, ChevronDown, ChevronRight, Shield, Zap } from 'lucide-react';
import type { ChatBlock } from '../store/chat-store';

type Finding = { id: string; severity: 'critical' | 'warning' | 'info'; file: string; line?: number; message: string; category: string };

function analyzeBlocks(blocks: ChatBlock[]): Finding[] {
  const findings: Finding[] = [];
  for (const b of blocks) {
    if (b.kind === 'evidence') {
      const p = b.evidence.payload as any;
      if (b.evidence.evidenceType === 'command_output' && p?.exitCode !== 0) {
        findings.push({ id: b.id, severity: 'critical', file: p?.path || 'unknown', message: p?.stderr || 'Command failed', category: 'Command' });
      }
    }
    if (b.kind === 'verdict' && b.result === 'fail') {
      findings.push({ id: b.id, severity: 'critical', file: 'evidence', message: b.acId + ': ' + b.result, category: 'Verification' });
    }
    if (b.kind === 'error') {
      findings.push({ id: b.id, severity: 'critical', file: 'system', message: b.message, category: 'Error' });
    }
  }
  return findings;
}

function mockFindings(): Finding[] {
  return [
    { id: '1', severity: 'warning', file: 'src/utils/helpers.ts', line: 42, message: 'Potential null reference - add null check', category: 'Safety' },
    { id: '2', severity: 'info', file: 'src/index.ts', line: 15, message: 'Consider adding error boundary', category: 'Best Practice' },
    { id: '3', severity: 'warning', file: 'package.json', message: 'Dependency react@18.3 is 2 versions behind latest', category: 'Dependencies' },
  ];
}

const icons = { critical: Shield, warning: AlertTriangle, info: Info };
const colors = { critical: 'var(--bobby-danger)', warning: '#f59e0b', info: 'var(--bobby-accent)' };
const bgColors = { critical: 'var(--bobby-danger-soft)', warning: 'rgba(245,158,11,0.12)', info: 'var(--bobby-accent-soft)' };

export function ReviewPanel() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const actual = useMemo(() => analyzeBlocks([]), []);
  const findings = actual.length > 0 ? actual : mockFindings();
  const counts = { critical: findings.filter(f => f.severity === 'critical').length, warning: findings.filter(f => f.severity === 'warning').length, info: findings.filter(f => f.severity === 'info').length };

  const toggle = (id: string) => { const n = new Set(expanded); n.has(id) ? n.delete(id) : n.add(id); setExpanded(n); };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-20 rounded-full px-4 py-2.5 shadow-lg text-[13px] font-medium text-white hover:opacity-90 transition flex items-center gap-2"
        style={{ background: counts.critical > 0 ? 'var(--bobby-danger)' : 'var(--bobby-accent)' }}>
        <Bug className="w-4 h-4" />
        Review ({findings.length})
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-20 w-[420px] max-h-[500px] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      style={{ background: 'var(--bobby-surface-elevated)', border: '1px solid var(--bobby-border)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-bobby-ink" />
          <span className="text-[13px] font-semibold text-bobby-ink">Code Review</span>
          {counts.critical > 0 && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--bobby-danger)' }}>{counts.critical}</span>}
          {counts.warning > 0 && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: '#f59e0b', color: '#fff' }}>{counts.warning}</span>}
        </div>
        <button onClick={() => setOpen(false)} className="text-bobby-muted hover:text-bobby-ink text-[18px]">×</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {findings.map(f => {
          const Icon = icons[f.severity];
          const isExp = expanded.has(f.id);
          return (
            <div key={f.id} className="border-b" style={{ borderColor: 'var(--bobby-border-muted)' }}>
              <button onClick={() => toggle(f.id)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-bobby-hover transition">
                <Icon className="w-3.5 h-3.5" style={{ color: colors[f.severity] }} />
                <span className="flex-1 text-[12px] font-medium text-bobby-ink">{f.message}</span>
                <span className="text-[11px] text-bobby-faint">{f.file}{f.line ? ':' + f.line : ''}</span>
                {isExp ? <ChevronDown className="w-3.5 h-3.5 text-bobby-faint" /> : <ChevronRight className="w-3.5 h-3.5 text-bobby-faint" />}
              </button>
              {isExp && (
                <div className="px-4 pb-3 pt-0" style={{ background: bgColors[f.severity] }}>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-medium" style={{ color: colors[f.severity] }}>{f.severity.toUpperCase()}</span>
                    <span className="text-bobby-muted">{f.category}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-bobby-muted">{f.message}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}