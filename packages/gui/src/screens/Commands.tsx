import React from 'react';
import { Command, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { makeKernelClient, type CommandRecordDto } from '../ipc/contract';

type CommandDraft = {
  sourcePath: string | null;
  name: string;
  description: string;
  promptTemplate: string;
};

function resolveClient() {
  if (typeof window === 'undefined' || (window as any).bobby === undefined) {
    return null;
  }

  return makeKernelClient();
}

function blankDraft(): CommandDraft {
  return {
    sourcePath: null,
    name: '',
    description: '',
    promptTemplate: 'Summarize the task and include:\n{{input}}'
  };
}

function draftFromCommand(command: CommandRecordDto): CommandDraft {
  return {
    sourcePath: command.sourcePath,
    name: command.name,
    description: command.description,
    promptTemplate: command.promptTemplate
  };
}

function notifyCommandsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('bobby:commands-changed'));
}

export function Commands() {
  const client = React.useMemo(resolveClient, []);
  const [items, setItems] = React.useState<CommandRecordDto[]>([]);
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<CommandDraft>(blankDraft);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!client?.listCommands) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextItems = await client.listCommands();
      setItems(nextItems);
      if (selectedPath && !nextItems.some((item) => item.sourcePath === selectedPath)) {
        setSelectedPath(nextItems[0]?.sourcePath ?? null);
      }
      if (!selectedPath && nextItems[0]) {
        setSelectedPath(nextItems[0].sourcePath);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, [client, selectedPath]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    const command = items.find((item) => item.sourcePath === selectedPath) ?? null;
    setDraft(command ? draftFromCommand(command) : blankDraft());
  }, [items, selectedPath]);

  const saveDraft = React.useCallback(async (): Promise<CommandRecordDto | null> => {
    if (!client?.upsertCommand) return null;
    if (!draft.name.trim() || !draft.description.trim() || !draft.promptTemplate.trim()) {
      setError('Fill in name, description, and template.');
      return null;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await client.upsertCommand({
        sourcePath: draft.sourcePath ?? undefined,
        name: draft.name.trim(),
        description: draft.description.trim(),
        promptTemplate: draft.promptTemplate.trim()
      });
      setItems((current) => {
        const filtered = current.filter((item) => item.sourcePath !== saved.sourcePath);
        return [saved, ...filtered].sort((left, right) => left.name.localeCompare(right.name));
      });
      setSelectedPath(saved.sourcePath);
      notifyCommandsChanged();
      return saved;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      return null;
    } finally {
      setSaving(false);
    }
  }, [client, draft]);

  const removeSelected = React.useCallback(async () => {
    if (!client?.removeCommand || !selectedPath) return;
    if (!window.confirm('Delete this command file?')) return;
    setSaving(true);
    setError(null);
    try {
      await client.removeCommand({ sourcePath: selectedPath });
      setItems((current) => current.filter((item) => item.sourcePath !== selectedPath));
      setSelectedPath(null);
      setDraft(blankDraft());
      notifyCommandsChanged();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }, [client, selectedPath]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bobby-canvas">
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <div>
          <h2 className="text-[13px] font-semibold text-bobby-ink">Commands</h2>
          <p className="mt-0.5 text-[11px] text-bobby-faint">Edit .bobby/commands files that feed the `/` menu.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-bobby-muted transition hover:bg-bobby-hover hover:text-bobby-ink"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-4 py-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-hidden rounded-xl border" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
          <div className="flex items-center justify-between border-b px-3 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
            <div>
              <h3 className="text-[13px] font-semibold text-bobby-ink">Command files</h3>
              <p className="mt-0.5 text-[11px] text-bobby-faint">{loading ? 'Loading...' : `${items.length} command${items.length === 1 ? '' : 's'}`}</p>
            </div>
            <button type="button" title="New command" onClick={() => { setSelectedPath(null); setDraft(blankDraft()); }} className="rounded-md p-1 text-bobby-muted hover:bg-bobby-hover hover:text-bobby-ink">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[calc(100vh-240px)] overflow-y-auto p-2">
            {items.length === 0 && !loading ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-[12px] text-bobby-faint" style={{ borderColor: 'var(--bobby-border-muted)' }}>
                No commands yet.
              </div>
            ) : (
              <div className="space-y-1">
                {items.map((item) => (
                  <button
                    key={item.sourcePath}
                    type="button"
                    onClick={() => setSelectedPath(item.sourcePath)}
                    className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-bobby-hover"
                    style={selectedPath === item.sourcePath ? { background: 'var(--bobby-accent-soft)' } : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <Command className="h-4 w-4 text-bobby-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-semibold text-bobby-ink">{item.name}</div>
                        <div className="truncate text-[11px] text-bobby-faint">{item.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="min-h-0 overflow-hidden rounded-xl border" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--bobby-border-muted)' }}>
            <div>
              <h3 className="text-[13px] font-semibold text-bobby-ink">{selectedPath ? draft.name || 'Edit command' : 'New command'}</h3>
              <p className="mt-0.5 text-[11px] text-bobby-faint">{selectedPath ?? 'Create a new slash command template'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'var(--bobby-accent)' }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => void removeSelected()}
                disabled={!selectedPath || saving}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-bobby-danger transition hover:bg-bobby-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-bobby-faint">Name</span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-bobby-faint">Description</span>
                <input
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-bobby-faint">Template</span>
                <textarea
                  value={draft.promptTemplate}
                  onChange={(event) => setDraft((current) => ({ ...current, promptTemplate: event.target.value }))}
                  className="min-h-[320px] w-full resize-y rounded-lg border px-3 py-2 text-[13px] leading-6 outline-none"
                  style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}
                  placeholder="Use {{input}} to inject typed arguments."
                />
              </label>

              {error && (
                <div className="rounded-lg border px-3 py-2 text-[12px] text-bobby-danger" style={{ background: 'var(--bobby-danger-soft)', borderColor: 'var(--bobby-danger-soft)' }}>
                  {error}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <section className="rounded-xl border p-4" style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}>
                <div className="flex items-center gap-2">
                  <Command className="h-4 w-4 text-bobby-muted" />
                  <h4 className="text-[13px] font-semibold text-bobby-ink">Slash menu</h4>
                </div>
                <p className="mt-2 text-[12px] leading-6 text-bobby-muted">
                  Save this file and the `/` menu in the composer will pick it up automatically. Use <code>{'{{input}}'}</code> to inject the typed arguments.
                </p>
              </section>

              <section className="rounded-xl border p-4" style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}>
                <h4 className="text-[13px] font-semibold text-bobby-ink">Current preview</h4>
                <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-lg bg-bobby-surface-card px-3 py-2 text-[12px] leading-6 text-bobby-ink">
{draft.promptTemplate}
                </pre>
              </section>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
