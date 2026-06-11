import React from 'react';
import { Loader2, Plus, Power, PowerOff, Server, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { makeKernelClient, type McpServerRecordDto, type McpServerUpsertInput } from '../ipc/contract';

type DraftTool = {
  name: string;
  permissionTier: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
  description: string;
  evidenceType: 'command_output' | 'file_diff' | 'file_exists';
};

const defaultToolLines = [
  'read_file|L2|Read a text file|command_output',
  'write_file|L1|Write a text file|file_diff',
  'list_directory|L0|List directory entries|command_output',
  'stat_path|L0|Check whether a path exists|file_exists'
].join('\n');

function parseToolLines(text: string): DraftTool[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, permissionTier, description, evidenceType] = line.split('|').map((part) => part.trim());
      return {
        name,
        permissionTier: (permissionTier ?? 'L1') as DraftTool['permissionTier'],
        description: description ?? '',
        evidenceType: (evidenceType ?? 'command_output') as DraftTool['evidenceType']
      };
    })
    .filter((tool) => tool.name.length > 0);
}

function formatTransport(server: McpServerRecordDto): string {
  if (server.transport.kind === 'stdio') {
    const args = server.transport.args.length > 0 ? ` ${server.transport.args.join(' ')}` : '';
    return `${server.transport.command}${args}`;
  }

  return server.transport.url;
}

function HealthBadge({ server }: { server: McpServerRecordDto }): JSX.Element {
  const tone =
    server.health === 'healthy'
      ? 'success'
      : server.health === 'error'
        ? 'danger'
        : server.health === 'disabled'
          ? 'warning'
          : 'muted';

  const label =
    server.health === 'healthy'
      ? 'Healthy'
      : server.health === 'error'
        ? 'Error'
        : server.health === 'disabled'
          ? 'Disabled'
          : 'Unknown';

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{
        background:
          tone === 'success'
            ? 'var(--bobby-success-soft)'
            : tone === 'danger'
              ? 'var(--bobby-danger-soft)'
              : tone === 'warning'
                ? 'rgba(217, 119, 6, 0.16)'
                : 'var(--bobby-hover)',
        color:
          tone === 'success'
            ? 'var(--bobby-success)'
            : tone === 'danger'
              ? 'var(--bobby-danger)'
              : tone === 'warning'
                ? '#d97706'
                : 'var(--bobby-muted)'
      }}
    >
      {tone === 'success' ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

export function PluginMarketplace(): JSX.Element {
  const kernelClient = React.useMemo(() => (typeof window !== 'undefined' && window.bobby ? makeKernelClient() : null), []);
  const [servers, setServers] = React.useState<McpServerRecordDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState('Filesystem Demo');
  const [kind, setKind] = React.useState<'stdio' | 'url'>('stdio');
  const [command, setCommand] = React.useState(typeof process !== 'undefined' ? process.execPath : 'node');
  const [url, setUrl] = React.useState('http://localhost:3000/mcp');
  const [args, setArgs] = React.useState('--input-type=module -e <demo server>');
  const [cwd, setCwd] = React.useState('');
  const [toolLines, setToolLines] = React.useState(defaultToolLines);

  const reload = React.useCallback(async () => {
    if (!kernelClient?.listMcpServers) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await kernelClient.listMcpServers();
      setServers(items);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, [kernelClient]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  async function submitServer() {
    if (!kernelClient?.upsertMcpServer) return;
    setSaving(true);
    setError(null);
    try {
      const tools = parseToolLines(toolLines);
      const input: McpServerUpsertInput = {
        name,
        enabled: true,
        transport:
          kind === 'stdio'
            ? {
                kind: 'stdio',
                command,
                args: args.split(/\s+/).map((item) => item.trim()).filter(Boolean),
                cwd: cwd.trim() || undefined
              }
            : {
                kind: 'url',
                url
              },
        tools
      };
      await kernelClient.upsertMcpServer(input);
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }

  async function toggleServer(id: string) {
    if (!kernelClient?.toggleMcpServer) return;
    setError(null);
    await kernelClient.toggleMcpServer({ id });
    await reload();
  }

  async function removeServer(id: string) {
    if (!kernelClient?.removeMcpServer) return;
    setError(null);
    await kernelClient.removeMcpServer({ id });
    await reload();
  }

  const inputClass = 'w-full rounded-lg border px-3 py-2 text-[13px] text-bobby-ink outline-none';

  return (
    <div className="flex h-full min-h-0 flex-col bg-bobby-canvas">
      <header className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <div>
          <h2 className="text-[15px] font-semibold text-bobby-ink">MCP Servers</h2>
          <p className="text-[12px] text-bobby-muted">Manage attached MCP servers, tool permissions, and health.</p>
        </div>
        <button
          type="button"
          onClick={() => void submitServer()}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add server
        </button>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="min-h-0 overflow-y-auto rounded-2xl border p-4" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
          <h3 className="mb-3 text-[13px] font-semibold text-bobby-ink">New server</h3>
          {error && <div className="mb-4 rounded-lg px-3 py-2 text-[12px]" style={{ background: 'var(--bobby-danger-soft)', color: 'var(--bobby-danger)' }}>{error}</div>}
          <div className="grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-[12px] font-medium text-bobby-muted">Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} style={{ background: 'var(--bobby-bg-canvas)', borderColor: 'var(--bobby-border)' }} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[12px] font-medium text-bobby-muted">Transport</span>
              <select value={kind} onChange={(event) => setKind(event.target.value as 'stdio' | 'url')} className={inputClass} style={{ background: 'var(--bobby-bg-canvas)', borderColor: 'var(--bobby-border)' }}>
                <option value="stdio">stdio command</option>
                <option value="url">streamable URL</option>
              </select>
            </label>
            {kind === 'stdio' ? (
              <>
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-medium text-bobby-muted">Command</span>
                  <input value={command} onChange={(event) => setCommand(event.target.value)} className={inputClass} style={{ background: 'var(--bobby-bg-canvas)', borderColor: 'var(--bobby-border)' }} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-medium text-bobby-muted">Args</span>
                  <input value={args} onChange={(event) => setArgs(event.target.value)} className={inputClass} style={{ background: 'var(--bobby-bg-canvas)', borderColor: 'var(--bobby-border)' }} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-medium text-bobby-muted">Cwd</span>
                  <input value={cwd} onChange={(event) => setCwd(event.target.value)} placeholder="Use current workspace when blank" className={inputClass} style={{ background: 'var(--bobby-bg-canvas)', borderColor: 'var(--bobby-border)' }} />
                </label>
              </>
            ) : (
              <label className="grid gap-1.5">
                <span className="text-[12px] font-medium text-bobby-muted">URL</span>
                <input value={url} onChange={(event) => setUrl(event.target.value)} className={inputClass} style={{ background: 'var(--bobby-bg-canvas)', borderColor: 'var(--bobby-border)' }} />
              </label>
            )}
            <label className="grid gap-1.5">
              <span className="text-[12px] font-medium text-bobby-muted">Tools</span>
              <textarea
                value={toolLines}
                onChange={(event) => setToolLines(event.target.value)}
                rows={8}
                className={inputClass}
                style={{ background: 'var(--bobby-bg-canvas)', borderColor: 'var(--bobby-border)' }}
              />
              <span className="text-[11px] text-bobby-faint">One tool per line: `name|tier|description|evidenceType`</span>
            </label>
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto rounded-2xl border p-4" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-bobby-ink">Installed servers</h3>
            <span className="text-[11px] text-bobby-faint">{loading ? 'Refreshing…' : `${servers.length} server${servers.length === 1 ? '' : 's'}`}</span>
          </div>
          <div className="grid gap-3">
            {servers.map((server) => (
              <article key={server.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--bobby-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-[13px] font-semibold text-bobby-ink">{server.name}</h4>
                    <p className="text-[11px] text-bobby-faint">{formatTransport(server)}</p>
                  </div>
                  <HealthBadge server={server} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {server.tools.map((tool) => (
                    <span key={`${server.id}:${tool.name}`} className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: 'var(--bobby-hover)', color: 'var(--bobby-muted)' }}>
                      {tool.name} · {tool.permissionTier}
                    </span>
                  ))}
                </div>

                {server.lastError && <p className="mt-3 rounded-lg px-3 py-2 text-[11px]" style={{ background: 'var(--bobby-danger-soft)', color: 'var(--bobby-danger)' }}>{server.lastError}</p>}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleServer(server.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] text-bobby-ink"
                    style={{ borderColor: 'var(--bobby-border)' }}
                  >
                    {server.enabled ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                    {server.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeServer(server.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] text-bobby-ink"
                    style={{ borderColor: 'var(--bobby-border)' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </article>
            ))}
            {!loading && servers.length === 0 && <p className="text-[12px] text-bobby-faint">No MCP servers configured.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
