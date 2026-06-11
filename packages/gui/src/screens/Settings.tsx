import React from 'react';
import { Key, Loader2, Save, Settings2, ShieldCheck } from 'lucide-react';
import { makeKernelClient, type AppSettings } from '../ipc/contract';

const DEFAULT_SETTINGS: AppSettings = {
  modelStrategy: 'auto',
  baseUrl: 'https://api.deepseek.com',
  workspaceDir: '/',
  budgetUsd: 10,
  defaultPermission: 'L1',
  strongSandbox: true,
  hasApiKey: false
};

function client() {
  return typeof window !== 'undefined' && window.bobby ? makeKernelClient() : null;
}

export function Settings(): React.ReactElement {
  const kernelClient = React.useMemo(client, []);
  const [settings, setSettings] = React.useState<AppSettings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = React.useState('');
  const [loading, setLoading] = React.useState(Boolean(kernelClient?.getSettings));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    if (!kernelClient?.getSettings) return;
    setLoading(true);
    void kernelClient.getSettings().then((value) => {
      if (!active) return;
      setSettings(value);
      setLoading(false);
    }).catch((nextError) => {
      if (!active) return;
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [kernelClient]);

  async function save() {
    if (!kernelClient?.setSettings) return;
    setSaving(true);
    setError(null);
    try {
      const next = await kernelClient.setSettings({
        modelStrategy: settings.modelStrategy,
        baseUrl: settings.baseUrl,
        workspaceDir: settings.workspaceDir,
        budgetUsd: settings.budgetUsd,
        defaultPermission: settings.defaultPermission,
        strongSandbox: settings.strongSandbox,
        apiKey: apiKey.trim() || undefined
      });
      setSettings(next);
      setApiKey('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full rounded-lg border px-3 py-2 text-[13px] text-bobby-ink outline-none';

  return (
    <div className="flex h-full flex-col bg-bobby-canvas">
      <header className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-bobby-muted" />
          <div>
            <h2 className="text-[15px] font-semibold text-bobby-ink">Settings</h2>
            <p className="text-[12px] text-bobby-muted">Main-process settings used by the next Bobby task.</p>
          </div>
        </div>
        <button type="button" onClick={() => void save()} disabled={saving || loading} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {error && <div className="mb-4 rounded-lg px-3 py-2 text-[12px]" style={{ background: 'var(--bobby-danger-soft)', color: 'var(--bobby-danger)' }}>{error}</div>}
        <div className="grid max-w-[680px] gap-5">
          <label className="grid gap-1.5">
            <span className="text-[12px] font-medium text-bobby-muted">Model Strategy</span>
            <select value={settings.modelStrategy} onChange={(event) => setSettings({ ...settings, modelStrategy: event.target.value as AppSettings['modelStrategy'] })} className={inputClass} style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
              <option value="auto">Auto</option>
              <option value="flash">Flash</option>
              <option value="pro">Pro</option>
              <option value="conservative">Conservative</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[12px] font-medium text-bobby-muted">Base URL</span>
            <input value={settings.baseUrl} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })} className={inputClass} style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[12px] font-medium text-bobby-muted">Workspace Directory</span>
            <input value={settings.workspaceDir} onChange={(event) => setSettings({ ...settings, workspaceDir: event.target.value })} className={inputClass} style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="text-[12px] font-medium text-bobby-muted">Budget USD</span>
              <input type="number" value={settings.budgetUsd} onChange={(event) => setSettings({ ...settings, budgetUsd: Number(event.target.value) })} className={inputClass} style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[12px] font-medium text-bobby-muted">Default Permission</span>
              <select value={settings.defaultPermission} onChange={(event) => setSettings({ ...settings, defaultPermission: event.target.value as AppSettings['defaultPermission'] })} className={inputClass} style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
                <option value="L0">L0</option>
                <option value="L1">L1</option>
                <option value="L2">L2</option>
                <option value="L3">L3</option>
                <option value="L4">L4</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-bobby-ink">
            <input type="checkbox" checked={settings.strongSandbox} onChange={(event) => setSettings({ ...settings, strongSandbox: event.target.checked })} />
            Strong sandbox
          </label>
          <section className="rounded-lg border p-4" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
            <div className="mb-3 flex items-center gap-2">
              <Key className="h-4 w-4 text-bobby-muted" />
              <h3 className="text-[13px] font-semibold text-bobby-ink">DeepSeek API Key</h3>
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-bobby-muted">
                <ShieldCheck className="h-3.5 w-3.5" /> {settings.hasApiKey ? 'stored in main process' : 'not stored'}
              </span>
            </div>
            <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste a new key to replace the stored key" className={inputClass} style={{ background: 'var(--bobby-bg-canvas)', borderColor: 'var(--bobby-border)' }} />
          </section>
        </div>
      </div>
    </div>
  );
}
