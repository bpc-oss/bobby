import React, { useState } from 'react';
import { FileText, ChevronRight, X } from 'lucide-react';
import { useChatStore, type ChatBlock } from '../store/chat-store';
import { DiffView } from './DiffView';

function collectDiffs(blocks: ChatBlock[]): { path: string; patch: string }[] {
  const diffs: { path: string; patch: string }[] = [];
  for (const b of blocks) {
    if (b.kind === 'evidence') {
      const p = b.evidence.payload as any;
      if (b.evidence.evidenceType === 'file_diff' && p?.path && p?.patch) {
        diffs.push({ path: p.path, patch: p.patch });
      }
    }
  }
  return diffs;
}

function collectFiles(blocks: ChatBlock[]): { path: string; exists: boolean }[] {
  const files: { path: string; exists: boolean }[] = [];
  for (const b of blocks) {
    if (b.kind === 'evidence' && b.evidence.evidenceType === 'file_exists') {
      const p = b.evidence.payload as any;
      if (p?.path) files.push({ path: p.path, exists: !!p.exists });
    }
  }
  return files;
}

export function RightPanel() {
  const blocks = useChatStore(s => s.blocks);
  const status = useChatStore(s => s.status);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'diffs' | 'files'>('diffs');

  const diffs = React.useMemo(() => collectDiffs(blocks), [blocks]);
  const files = React.useMemo(() => collectFiles(blocks), [blocks]);
  const totalItems = diffs.length + files.length;

  if (totalItems === 0) return null;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-l-xl border border-r-0 px-2 py-4 text-[11px] text-bobby-muted hover:text-bobby-ink transition-colors z-10"
        style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-medium">{totalItems} changes</span>
      </button>
    );
  }

  return (
    <div className="flex h-full w-[380px] flex-col border-l" style={{ background: 'var(--bobby-bg-canvas)', borderColor: 'var(--bobby-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <div className="flex items-center gap-1">
          <button onClick={() => setTab('diffs')} className={`rounded-lg px-3 py-1 text-[12px] font-medium transition ${tab === 'diffs' ? 'text-bobby-ink' : 'text-bobby-muted hover:text-bobby-ink'}`} style={tab === 'diffs' ? { background: 'var(--bobby-surface-hover)' } : {}}>
            Diffs ({diffs.length})
          </button>
          <button onClick={() => setTab('files')} className={`rounded-lg px-3 py-1 text-[12px] font-medium transition ${tab === 'files' ? 'text-bobby-ink' : 'text-bobby-muted hover:text-bobby-ink'}`} style={tab === 'files' ? { background: 'var(--bobby-surface-hover)' } : {}}>
            Files ({files.length})
          </button>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-md p-1 text-bobby-muted hover:text-bobby-ink"><X className="w-4 h-4" /></button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tab === 'diffs' && diffs.map((d, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-bobby-muted" />
              <span className="text-[12px] font-medium text-bobby-ink">{d.path.split(/[/\\]/).pop()}</span>
              <span className="text-[11px] text-bobby-faint">{d.path}</span>
            </div>
            <DiffView patch={d.patch} maxHeight={260} />
          </div>
        ))}
        {tab === 'diffs' && diffs.length === 0 && <p className="text-[13px] text-bobby-muted text-center py-8">No file diffs yet</p>}
        {tab === 'files' && files.map((f, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--bobby-surface-subtle)' }}>
            <FileText className="w-3.5 h-3.5 text-bobby-muted" />
            <span className="text-[12px] text-bobby-ink">{f.path.split(/[/\\]/).pop()}</span>
            <span className={`ml-auto text-[11px] font-medium ${f.exists ? 'text-bobby-success' : 'text-bobby-danger'}`}>{f.exists ? '✓' : '✗'}</span>
          </div>
        ))}
        {tab === 'files' && files.length === 0 && <p className="text-[13px] text-bobby-muted text-center py-8">No files yet</p>}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2 text-[11px] text-bobby-faint text-center" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        {status !== 'idle' ? status : 'Ready'}
      </div>
    </div>
  );
}