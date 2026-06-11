import React, { useState } from 'react';
import { ChevronRight, FileText, X } from 'lucide-react';
import { useChatStore, type ChatBlock } from '../store/chat-store';
import { DiffView } from './DiffView';

function collectDiffs(blocks: ChatBlock[]): { path: string; patch: string }[] {
  const diffs: { path: string; patch: string }[] = [];
  for (const block of blocks) {
    if (block.kind === 'evidence') {
      const payload = block.evidence.payload as Record<string, unknown>;
      if (block.evidence.evidenceType === 'file_diff' && payload.path && payload.patch) {
        diffs.push({ path: String(payload.path), patch: String(payload.patch) });
      }
    }
  }
  return diffs;
}

function collectFiles(blocks: ChatBlock[]): { path: string; exists: boolean }[] {
  const files: { path: string; exists: boolean }[] = [];
  for (const block of blocks) {
    if (block.kind === 'evidence' && block.evidence.evidenceType === 'file_exists') {
      const payload = block.evidence.payload as Record<string, unknown>;
      if (payload.path) files.push({ path: String(payload.path), exists: Boolean(payload.exists) });
    }
  }
  return files;
}

export function RightPanel() {
  const blocks = useChatStore((s) => s.blocks);
  const status = useChatStore((s) => s.status);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'diffs' | 'files'>('diffs');
  const diffs = React.useMemo(() => collectDiffs(blocks), [blocks]);
  const files = React.useMemo(() => collectFiles(blocks), [blocks]);
  const totalItems = diffs.length + files.length;

  if (totalItems === 0) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 rounded-l-xl border border-r-0 px-2 py-4 text-[11px] text-bobby-muted transition-colors hover:text-bobby-ink"
        style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}
      >
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-medium">{totalItems} changes</span>
      </button>
    );
  }

  return (
    <div className="flex h-full w-[380px] flex-col border-l" style={{ background: 'var(--bobby-bg-canvas)', borderColor: 'var(--bobby-border)' }}>
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <div className="flex items-center gap-1">
          <button onClick={() => setTab('diffs')} className={`rounded-lg px-3 py-1 text-[12px] font-medium transition ${tab === 'diffs' ? 'text-bobby-ink' : 'text-bobby-muted hover:text-bobby-ink'}`} style={tab === 'diffs' ? { background: 'var(--bobby-surface-hover)' } : {}}>
            Diffs ({diffs.length})
          </button>
          <button onClick={() => setTab('files')} className={`rounded-lg px-3 py-1 text-[12px] font-medium transition ${tab === 'files' ? 'text-bobby-ink' : 'text-bobby-muted hover:text-bobby-ink'}`} style={tab === 'files' ? { background: 'var(--bobby-surface-hover)' } : {}}>
            Files ({files.length})
          </button>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-md p-1 text-bobby-muted hover:text-bobby-ink"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {tab === 'diffs' && diffs.map((diff, index) => (
          <div key={`${diff.path}:${index}`}>
            <div className="mb-1.5 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-bobby-muted" />
              <span className="text-[12px] font-medium text-bobby-ink">{diff.path.split(/[/\\]/).pop()}</span>
              <span className="text-[11px] text-bobby-faint">{diff.path}</span>
            </div>
            <DiffView patch={diff.patch} maxHeight={260} />
          </div>
        ))}
        {tab === 'diffs' && diffs.length === 0 && <p className="py-8 text-center text-[13px] text-bobby-muted">No file diffs yet</p>}
        {tab === 'files' && files.map((file, index) => (
          <div key={`${file.path}:${index}`} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--bobby-surface-subtle)' }}>
            <FileText className="h-3.5 w-3.5 text-bobby-muted" />
            <span className="text-[12px] text-bobby-ink">{file.path.split(/[/\\]/).pop()}</span>
            <span className={`ml-auto text-[11px] font-medium ${file.exists ? 'text-bobby-success' : 'text-bobby-danger'}`}>{file.exists ? 'exists' : 'missing'}</span>
          </div>
        ))}
        {tab === 'files' && files.length === 0 && <p className="py-8 text-center text-[13px] text-bobby-muted">No files yet</p>}
      </div>

      <div className="border-t px-4 py-2 text-center text-[11px] text-bobby-faint" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        {status !== 'idle' ? status : 'Ready'}
      </div>
    </div>
  );
}
