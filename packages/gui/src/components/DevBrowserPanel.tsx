import React, { useState } from 'react';
import { Globe, RefreshCw, ExternalLink } from 'lucide-react';

export function DevBrowserPanel() {
  const [url, setUrl] = useState('http://localhost:3000');
  const [history, setHistory] = useState<string[]>(['http://localhost:3000', 'http://localhost:5173']);

  return (
    <div className="flex h-full flex-col bg-bobby-canvas" style={{ borderLeft: '1px solid var(--bobby-border)' }}>
      <div className="flex items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <button className="rounded-md p-1 text-bobby-muted hover:text-bobby-ink transition"><RefreshCw className="w-3.5 h-3.5" /></button>
        <input value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') setHistory(prev => [url, ...prev.slice(0, 9)]); }}
          className="flex-1 rounded-lg border px-2.5 py-1 text-[12px] font-mono text-bobby-ink outline-none focus:border-accent/40"
          style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }} />
        <button onClick={() => { setHistory(prev => [url, ...prev.slice(0, 9)]); }} className="rounded-md p-1 text-bobby-muted hover:text-bobby-ink"><Globe className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-bobby-muted p-4">
        <Globe className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-[13px]">Preview</p>
        <p className="text-[12px] text-bobby-faint mt-1">Enter a localhost URL to preview your app</p>
        {history.length > 0 && (
          <div className="mt-4 w-full max-w-[300px]">
            <h3 className="text-[11px] font-semibold text-bobby-faint mb-2">Recent</h3>
            {history.map(h => (
              <button key={h} onClick={() => setUrl(h)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-bobby-muted hover:text-bobby-ink hover:bg-bobby-hover transition">
                <ExternalLink className="w-3 h-3" />{h}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}