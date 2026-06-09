import React, { useState, useEffect } from 'react';
import { Key, Keyboard, Settings2 } from 'lucide-react';

function load(k: string, d: string) { try { return localStorage.getItem('bobby-' + k) ?? d; } catch { return d; } }
function save(k: string, v: string) { try { localStorage.setItem('bobby-' + k, v); } catch {} }

export function Settings(): React.ReactElement {
  const [tab, setTab] = useState<'general' | 'api' | 'shortcuts'>('general');
  const [model, setModel] = useState(() => load('model', 'deepseek-chat'));
  const [apiKey, setApiKey] = useState(() => load('api-key', ''));
  const [baseUrl, setBaseUrl] = useState(() => load('base-url', 'https://api.deepseek.com'));
  const [workspace, setWorkspace] = useState(() => load('workspace', '/'));
  const [budget, setBudget] = useState(() => load('budget', '10'));
  const [permission, setPermission] = useState(() => load('permission', 'L1'));
  const [sandbox, setSandbox] = useState(() => load('sandbox', 'false') === 'true');
  const [saved, setSaved] = useState(false);

  useEffect(() => { save('model', model); save('api-key', apiKey); save('base-url', baseUrl); save('workspace', workspace); save('budget', budget); save('permission', permission); save('sandbox', String(sandbox)); }, [model, apiKey, baseUrl, workspace, budget, permission, sandbox]);

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings2 },
    { id: 'api' as const, label: 'API', icon: Key },
    { id: 'shortcuts' as const, label: 'Shortcuts', icon: Keyboard },
  ];

  const inputCls = "w-full rounded-xl border px-3 py-2 text-[13px] text-bobby-ink outline-none transition-colors focus:border-accent/50";
  const labelCls = "text-[12px] font-medium text-bobby-muted mb-1 block";
  const sectionCls = "mb-5";

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  return (
    <div className="flex h-full flex-col bg-bobby-canvas">
      <div className="flex items-center gap-1 border-b border-bobby-border-muted px-4 py-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${tab === t.id ? 'text-bobby-ink' : 'text-bobby-muted hover:text-bobby-ink'}`}
            style={tab === t.id ? { background: 'var(--bobby-surface-hover)' } : {}}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 max-w-[560px]">
        {tab === 'general' && (
          <>
            <div className={sectionCls}>
              <label className={labelCls}>Model</label>
              <select value={model} onChange={e => setModel(e.target.value)} className={inputCls} style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
                <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
              </select>
            </div>
            <div className={sectionCls}>
              <label className={labelCls}>Workspace Root</label>
              <input value={workspace} onChange={e => setWorkspace(e.target.value)} className={inputCls} style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }} placeholder="/path/to/project" />
            </div>
            <div className={sectionCls}>
              <label className={labelCls}>Budget Limit (USD)</label>
              <input type="number" value={budget} onChange={e => setBudget(e.target.value)} className={inputCls} style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }} />
            </div>
            <div className={sectionCls}>
              <label className={labelCls}>Default Permission Level</label>
              <select value={permission} onChange={e => setPermission(e.target.value)} className={inputCls} style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
                <option value="L0">L0 - Read only</option>
                <option value="L1">L1 - Workspace write</option>
                <option value="L2">L2 - Full access</option>
                <option value="L3">L3 - Auto approve</option>
                <option value="L4">L4 - Unrestricted</option>
              </select>
            </div>
            <div className={sectionCls}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sandbox} onChange={e => setSandbox(e.target.checked)} className="rounded" />
                <span className="text-[13px] text-bobby-ink">Strong Sandbox</span>
              </label>
            </div>
          </>
        )}

        {tab === 'api' && (
          <>
            <div className={sectionCls}>
              <label className={labelCls}>DeepSeek API Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className={inputCls} style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }} placeholder="sk-..." />
              <p className="text-[11px] text-bobby-faint mt-1">Stored in browser localStorage. In production, use ~/.bobby/key.</p>
            </div>
            <div className={sectionCls}>
              <label className={labelCls}>Base URL</label>
              <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className={inputCls} style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }} />
            </div>
          </>
        )}

        {tab === 'shortcuts' && (
          <div className="space-y-3">
            {[
              ['Ctrl+K', 'Clear chat'],
              ['Ctrl+N', 'New session'],
              ['Ctrl+Enter', 'Send message'],
              ['Escape', 'Cancel editing'],
              ['Double-click', 'Edit message'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between rounded-lg px-4 py-2.5" style={{ background: 'var(--bobby-surface-subtle)' }}>
                <span className="text-[13px] text-bobby-ink">{desc}</span>
                <kbd className="rounded-md px-2 py-0.5 text-[11px] font-mono font-medium" style={{ background: 'var(--bobby-kbd-bg)', color: 'var(--bobby-text-muted)', border: '1px solid var(--bobby-border)' }}>{key}</kbd>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-bobby-border-muted px-6 py-3 flex items-center justify-between">
        <span className="text-[11px] text-bobby-faint">Settings auto-saved to browser storage.</span>
        <button onClick={handleSave} className="rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-white hover:brightness-110 transition">
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  );
}
