import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, FileCode } from 'lucide-react';
import { useChatStore, type ChatBlock } from '../store/chat-store';
import { DiffView } from './DiffView';

type Change = { file: string; type: 'added' | 'modified' | 'deleted'; patch?: string; tool: string };

function extractChanges(blocks: ChatBlock[]): Change[] {
  const changes: Change[] = [];
  for (const block of blocks) {
    if (block.kind === 'tool') {
      const match = block.tool.match(/write_file\s+(\S+)/);
      if (match) changes.push({ file: match[1], type: 'added', tool: block.tool });
      else if (block.tool.includes('exec')) changes.push({ file: 'stdout', type: 'modified', tool: block.tool });
    }
    if (block.kind === 'evidence') {
      const payload = block.evidence.payload as Record<string, unknown>;
      if (block.evidence.evidenceType === 'file_diff' && payload.path) {
        changes.push({
          file: String(payload.path),
          type: 'modified',
          patch: typeof payload.patch === 'string' ? payload.patch : undefined,
          tool: 'file_diff'
        });
      }
    }
  }
  return changes;
}

export function ChangeInspector() {
  const blocks = useChatStore((s) => s.blocks);
  const changes = useMemo(() => extractChanges(blocks), [blocks]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (file: string) => {
    const next = new Set(expanded);
    next.has(file) ? next.delete(file) : next.add(file);
    setExpanded(next);
  };

  return (
    <div className="flex h-full flex-col bg-bobby-canvas" style={{ borderLeft: '1px solid var(--bobby-border)' }}>
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <ArrowRightLeft className="h-4 w-4 text-bobby-ink" />
        <h2 className="text-[13px] font-semibold text-bobby-ink">Changes</h2>
        <span className="ml-auto text-[11px] text-bobby-faint">{changes.length} files</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {changes.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-bobby-muted">
            No file changes recorded for this session.
          </div>
        )}
        {changes.map((change) => (
          <div key={`${change.tool}:${change.file}`}>
            <button
              onClick={() => toggle(change.file)}
              className="flex w-full items-center gap-2 border-b px-4 py-2.5 text-left transition hover:bg-bobby-hover"
              style={{ borderColor: 'var(--bobby-border-muted)' }}
            >
              <FileCode className="h-3.5 w-3.5 text-bobby-muted" />
              <span className="flex-1 font-mono text-[12px] text-bobby-ink">{change.file}</span>
              <span className={`text-[11px] font-medium ${change.type === 'added' ? 'text-bobby-success' : change.type === 'deleted' ? 'text-bobby-danger' : 'text-bobby-muted'}`}>
                {change.type === 'added' ? '+' : change.type === 'deleted' ? '-' : '~'}
              </span>
            </button>
            {expanded.has(change.file) && change.patch && (
              <div className="px-3 py-2">
                <DiffView patch={change.patch} maxHeight={220} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
