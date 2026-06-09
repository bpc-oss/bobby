import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Play, FileCode, FolderOpen } from 'lucide-react';

export function CodeMode({ onClose }: { onClose: () => void }) {
  const [output, setOutput] = useState<string[]>([
    '$ bobby code --workspace /project',
    'Code mode active. Type commands or use the chat to execute tasks.',
    'Workspace: /project · Branch: main · Model: deepseek-chat',
    '',
  ]);
  const [cmd, setCmd] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [output]);

  const run = (c: string) => {
    setOutput(prev => [...prev, '$ ' + c]);
    if (c.startsWith('ls')) { setOutput(prev => [...prev, 'src/  package.json  tsconfig.json  README.md  node_modules/']); }
    else if (c.startsWith('cat ')) { setOutput(prev => [...prev, '# File content preview (mock)']); }
    else if (c.startsWith('git ')) { setOutput(prev => [...prev, c.includes('diff') ? 'diff --git a/src/index.ts b/src/index.ts\n+import { StrictMode } from "react";' : 'On branch main\nnothing to commit, working tree clean']); }
    else if (c === 'clear') { setOutput([]); }
    else { setOutput(prev => [...prev, 'Command executed (mock mode). Real execution needs kernel backend.']); }
  };

  return (
    <div className="flex h-full flex-col bg-bobby-canvas">
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)', background: 'var(--bobby-topbar-bg)' }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="rounded-md px-2 py-1 text-[13px] text-bobby-muted hover:text-bobby-ink transition">← Back</button>
          <Terminal className="w-4 h-4 text-bobby-ink" />
          <span className="text-[13px] font-semibold text-bobby-ink">Code Mode</span>
          <span className="text-[11px] text-bobby-faint font-mono">main</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg px-2 py-1 text-[11px] text-bobby-muted hover:text-bobby-ink">
            <FileCode className="w-3.5 h-3.5 inline mr-1" />Files
          </button>
          <button className="rounded-lg px-2 py-1 text-[11px] text-bobby-muted hover:text-bobby-ink">
            <FolderOpen className="w-3.5 h-3.5 inline mr-1" />Open
          </button>
        </div>
      </div>

      <div ref={ref} className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed" style={{ background: '#0d1117', color: '#c9d1d9' }}>
        {output.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap" style={{ color: line.startsWith('$ ') ? '#58a6ff' : line.startsWith('#') ? '#8b949e' : '#c9d1d9' }}>
            {line}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[#58a6ff]">$</span>
          <input value={cmd} onChange={e => setCmd(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { run(cmd); setCmd(''); } }}
            className="flex-1 bg-transparent text-[#c9d1d9] outline-none border-0 font-mono text-[13px]"
            placeholder="Enter command (ls, cat, git diff, clear)..."
            autoFocus />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t px-4 py-1.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <button onClick={() => { run('ls'); }} className="rounded-md px-2 py-0.5 text-[11px] font-mono text-bobby-muted hover:text-bobby-ink hover:bg-bobby-hover transition">ls</button>
        <button onClick={() => { run('git status'); }} className="rounded-md px-2 py-0.5 text-[11px] font-mono text-bobby-muted hover:text-bobby-ink hover:bg-bobby-hover transition">git status</button>
        <button onClick={() => { run('git diff'); }} className="rounded-md px-2 py-0.5 text-[11px] font-mono text-bobby-muted hover:text-bobby-ink hover:bg-bobby-hover transition">git diff</button>
        <button onClick={() => { run('clear'); setCmd(''); }} className="rounded-md px-2 py-0.5 text-[11px] font-mono text-bobby-muted hover:text-bobby-ink hover:bg-bobby-hover transition ml-auto">clear</button>
      </div>
    </div>
  );
}