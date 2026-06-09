import React, { useState, useMemo } from 'react';
import { GitBranch, FileCode, ArrowRightLeft } from 'lucide-react';
import type { ChatBlock } from '../store/chat-store';
import { DiffView } from '../components/DiffView';

type Change = { file: string; type: 'added' | 'modified' | 'deleted'; patch?: string; tool: string };

function extractChanges(blocks: ChatBlock[]): Change[] {
  const changes: Change[] = [];
  for (const b of blocks) {
    if (b.kind === 'tool') {
      const match = b.tool.match(/write_file\s+(\S+)/);
      if (match) changes.push({ file: match[1], type: 'added', tool: b.tool });
      else if (b.tool.includes('exec')) changes.push({ file: 'stdout', type: 'modified', tool: b.tool });
    }
    if (b.kind === 'evidence') {
      const p = b.evidence.payload as any;
      if (b.evidence.evidenceType === 'file_diff' && p?.path) {
        changes.push({ file: p.path, type: 'modified', patch: p.patch, tool: 'file_diff' });
      }
    }
  }
  return changes;
}

export function ChangeInspector() {
  const blocks: ChatBlock[] = [];
  const changes = useMemo(() => {
    const ch = extractChanges(blocks);
    return ch.length > 0 ? ch : [
      { file: 'src/index.ts', type: 'modified' as const, patch: '@@ -1,5 +1,7 @@\n import React from "react";\n+import { StrictMode } from "react";\n+\n const App = () => {\n-  return <div>Hello</div>;\n+  return <StrictMode><div>Hello World</div></StrictMode>;\n };', tool: '' },
      { file: 'README.md', type: 'added' as const, patch: '@@ -0,0 +1,3 @@\n+# Bobby\n+\n+Your local coding agent.', tool: '' },
    ];
  }, [blocks]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set(['src/index.ts']));
  const toggle = (f: string) => { const n = new Set(expanded); n.has(f) ? n.delete(f) : n.add(f); setExpanded(n); };

  return (
    <div className="flex h-full flex-col bg-bobby-canvas" style={{ borderLeft: '1px solid var(--bobby-border)' }}>
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <ArrowRightLeft className="w-4 h-4 text-bobby-ink" />
        <h2 className="text-[13px] font-semibold text-bobby-ink">Changes</h2>
        <span className="text-[11px] text-bobby-faint ml-auto">{changes.length} files</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {changes.map(ch => (
          <div key={ch.file}>
            <button onClick={() => toggle(ch.file)}
              className="flex w-full items-center gap-2 border-b px-4 py-2.5 text-left hover:bg-bobby-hover transition"
              style={{ borderColor: 'var(--bobby-border-muted)' }}>
              <FileCode className="w-3.5 h-3.5 text-bobby-muted" />
              <span className="flex-1 text-[12px] font-mono text-bobby-ink">{ch.file}</span>
              <span className={`text-[11px] font-medium ${ch.type === 'added' ? 'text-bobby-success' : ch.type === 'deleted' ? 'text-bobby-danger' : 'text-bobby-muted'}`}>
                {ch.type === 'added' ? '+' : ch.type === 'deleted' ? '-' : '~'}
              </span>
            </button>
            {expanded.has(ch.file) && ch.patch && (
              <div className="px-3 py-2">
                <DiffView patch={ch.patch} maxHeight={220} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}