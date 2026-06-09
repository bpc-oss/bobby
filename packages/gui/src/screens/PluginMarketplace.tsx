import React, { useState } from 'react';
import { Search, Download, Star, ExternalLink } from 'lucide-react';

const mockPlugins = [
  { id: '1', name: 'Code Review Bot', description: 'Automated PR review with best practice checks', author: 'bobby-team', stars: 128, installed: true },
  { id: '2', name: 'Test Generator', description: 'Generate unit tests from source code', author: 'bobby-labs', stars: 95, installed: false },
  { id: '3', name: 'Docker Helper', description: 'Dockerfile generation and container management', author: 'community', stars: 64, installed: true },
  { id: '4', name: 'API Docs', description: 'Auto-generate OpenAPI docs from route definitions', author: 'bobby-team', stars: 41, installed: false },
  { id: '5', name: 'Performance Profiler', description: 'CPU and memory profiling for Node.js apps', author: 'community', stars: 33, installed: false },
];

export function PluginMarketplace() {
  const [search, setSearch] = useState('');
  const [plugins, setPlugins] = useState(mockPlugins);
  const filtered = plugins.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase()));

  const toggleInstall = (id: string) => {
    setPlugins(prev => prev.map(p => p.id === id ? { ...p, installed: !p.installed } : p));
  };

  return (
    <div className="flex h-full flex-col bg-bobby-canvas">
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <h2 className="text-[13px] font-semibold text-bobby-ink">Plugin Marketplace</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-bobby-faint" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search plugins..."
            className="w-56 rounded-lg border py-1.5 pl-8 pr-3 text-[12px] text-bobby-ink outline-none focus:border-accent/40"
            style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3 max-w-[700px] mx-auto">
          {filtered.map(p => (
            <div key={p.id} className="rounded-2xl border p-4 transition hover:shadow-md"
              style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-[13px] font-semibold text-bobby-ink">{p.name}</h3>
                <button onClick={() => toggleInstall(p.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                    p.installed ? 'text-bobby-success bg-bobby-success-soft' : 'text-white'
                  }`}
                  style={!p.installed ? { background: 'var(--bobby-accent)' } : {}}>
                  {p.installed ? 'Installed' : 'Install'}
                </button>
              </div>
              <p className="text-[12px] text-bobby-muted mb-3">{p.description}</p>
              <div className="flex items-center gap-3 text-[11px] text-bobby-faint">
                <span>{p.author}</span>
                <span className="flex items-center gap-1"><Star className="w-3 h-3" />{p.stars}</span>
                <ExternalLink className="w-3 h-3 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}