import React from 'react';
import { Bot, CheckCircle2, Plus, Play, RefreshCw, Trash2 } from 'lucide-react';
import { makeKernelClient, type SubAgentDispatchRecordDto, type SubAgentRecordDto } from '../ipc/contract';

type AgentDraft = {
  sourcePath: string | null;
  name: string;
  description: string;
  model: string;
  tools: string;
  triggers: string;
  systemPrompt: string;
};

function resolveClient() {
  if (typeof window === 'undefined' || (window as any).bobby === undefined) {
    return null;
  }

  return makeKernelClient();
}

function blankDraft(): AgentDraft {
  return {
    sourcePath: null,
    name: '',
    description: '',
    model: '',
    tools: '',
    triggers: '',
    systemPrompt: 'You are a focused coding subagent.'
  };
}

function draftFromAgent(agent: SubAgentRecordDto): AgentDraft {
  return {
    sourcePath: agent.sourcePath,
    name: agent.name,
    description: agent.description,
    model: agent.model ?? '',
    tools: agent.tools.join(', '),
    triggers: agent.triggers.join(', '),
    systemPrompt: agent.systemPrompt
  };
}

function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function DispatchBadge({ record }: { record: SubAgentDispatchRecordDto }) {
  const palette = {
    queued: { label: 'Queued', color: 'var(--bobby-muted)', bg: 'var(--bobby-surface-subtle)' },
    running: { label: 'Running', color: 'var(--bobby-accent)', bg: 'var(--bobby-accent-soft)' },
    completed: { label: 'Done', color: 'var(--bobby-success)', bg: 'var(--bobby-success-soft)' },
    failed: { label: 'Failed', color: 'var(--bobby-danger)', bg: 'var(--bobby-danger-soft)' }
  } as const;
  const style = palette[record.status];
  const mergeLabel =
    record.mergeState === 'applied' ? 'Applied' :
    record.mergeState === 'ready' ? 'Ready to apply' :
    record.mergeState === 'blocked' ? 'Blocked' :
    'Pending';

  return (
    <article className="rounded-xl border px-4 py-3" style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-[13px] font-semibold text-bobby-ink">{record.agentName}</h4>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: style.bg, color: style.color }}>
              {style.label}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: 'var(--bobby-chip-bg)', color: 'var(--bobby-muted)' }}>
              {mergeLabel}
            </span>
          </div>
          <p className="mt-1 break-words text-[12px] leading-5 text-bobby-muted">{record.task}</p>
          <div className="mt-2 space-y-1 text-[11px] text-bobby-faint">
            <div className="truncate">worktree: {record.worktreePath ?? '-'}</div>
            <div className="truncate">proposal: {record.proposalPath ?? '-'}</div>
            <div className="truncate">error: {record.error ?? '-'}</div>
          </div>
        </div>
        <div className="shrink-0 text-[11px] text-bobby-faint">{new Date(record.updatedAt).toLocaleString()}</div>
      </div>
    </article>
  );
}

export function Agents() {
  const client = React.useMemo(resolveClient, []);
  const [agents, setAgents] = React.useState<SubAgentRecordDto[]>([]);
  const [dispatches, setDispatches] = React.useState<SubAgentDispatchRecordDto[]>([]);
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<AgentDraft>(blankDraft);
  const [task, setTask] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dispatching, setDispatching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!client?.listSubAgents) {
      setAgents([]);
      setDispatches([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [nextAgents, nextDispatches] = await Promise.all([
        client.listSubAgents(),
        client.listSubAgentDispatches?.() ?? Promise.resolve([])
      ]);
      setAgents(nextAgents);
      setDispatches(nextDispatches);
      if (selectedPath && !nextAgents.some((agent) => agent.sourcePath === selectedPath)) {
        setSelectedPath(nextAgents[0]?.sourcePath ?? null);
      }
      if (!selectedPath && nextAgents[0]) {
        setSelectedPath(nextAgents[0].sourcePath);
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
    const agent = agents.find((item) => item.sourcePath === selectedPath) ?? null;
    setDraft(agent ? draftFromAgent(agent) : blankDraft());
  }, [agents, selectedPath]);

  const saveDraft = React.useCallback(async (): Promise<SubAgentRecordDto | null> => {
    if (!client?.upsertSubAgent) return null;
    if (!draft.name.trim() || !draft.description.trim() || !draft.systemPrompt.trim()) {
      setError('Fill in name, description, and prompt.');
      return null;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await client.upsertSubAgent({
        sourcePath: draft.sourcePath ?? undefined,
        name: draft.name.trim(),
        description: draft.description.trim(),
        model: draft.model.trim() || undefined,
        tools: parseCsv(draft.tools),
        triggers: parseCsv(draft.triggers),
        systemPrompt: draft.systemPrompt.trim()
      });
      setAgents((current) => {
        const filtered = current.filter((item) => item.sourcePath !== saved.sourcePath);
        return [saved, ...filtered].sort((left, right) => left.name.localeCompare(right.name));
      });
      setSelectedPath(saved.sourcePath);
      return saved;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      return null;
    } finally {
      setSaving(false);
    }
  }, [client, draft]);

  const removeSelected = React.useCallback(async () => {
    if (!client?.removeSubAgent || !selectedPath) return;
    if (!window.confirm('Delete this subagent file?')) return;
    setSaving(true);
    setError(null);
    try {
      await client.removeSubAgent({ sourcePath: selectedPath });
      setAgents((current) => current.filter((item) => item.sourcePath !== selectedPath));
      setSelectedPath(null);
      setDraft(blankDraft());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }, [client, selectedPath]);

  const dispatchAgent = React.useCallback(async () => {
    if (!client?.dispatchSubAgent) return;
    const saved = await saveDraft();
    if (!saved) return;

    if (!task.trim()) {
      setError('Provide a background task prompt.');
      return;
    }

    setDispatching(true);
    setError(null);
    try {
      await client.dispatchSubAgent({
        sourcePath: saved.sourcePath,
        task: task.trim()
      });
      setTask('');
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setDispatching(false);
    }
  }, [client, refresh, saveDraft, task]);

  const selectedAgent = agents.find((item) => item.sourcePath === selectedPath) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-bobby-canvas">
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <div>
          <h2 className="text-[13px] font-semibold text-bobby-ink">Agents</h2>
          <p className="mt-0.5 text-[11px] text-bobby-faint">Edit .bobby/agents files and dispatch worktree-backed tasks.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedPath(null);
            setDraft(blankDraft());
          }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-bobby-muted transition hover:bg-bobby-hover hover:text-bobby-ink"
        >
          <Plus className="h-3.5 w-3.5" />
          New agent
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-4 py-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-hidden rounded-xl border" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
          <div className="flex items-center justify-between border-b px-3 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
            <div>
              <h3 className="text-[13px] font-semibold text-bobby-ink">Agent files</h3>
              <p className="mt-0.5 text-[11px] text-bobby-faint">{loading ? 'Loading...' : `${agents.length} agent${agents.length === 1 ? '' : 's'}`}</p>
            </div>
            <button type="button" onClick={() => void refresh()} className="rounded-md p-1 text-bobby-muted hover:bg-bobby-hover hover:text-bobby-ink">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[calc(100vh-240px)] overflow-y-auto p-2">
            {agents.length === 0 && !loading ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-[12px] text-bobby-faint" style={{ borderColor: 'var(--bobby-border-muted)' }}>
                No agents yet.
              </div>
            ) : (
              <div className="space-y-1">
                {agents.map((agent) => (
                  <button
                    key={agent.sourcePath}
                    type="button"
                    onClick={() => setSelectedPath(agent.sourcePath)}
                    className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-bobby-hover"
                    style={selectedPath === agent.sourcePath ? { background: 'var(--bobby-accent-soft)' } : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-bobby-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-semibold text-bobby-ink">{agent.name}</div>
                        <div className="truncate text-[11px] text-bobby-faint">{agent.description}</div>
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
              <h3 className="text-[13px] font-semibold text-bobby-ink">{selectedAgent ? selectedAgent.name : 'New agent'}</h3>
              <p className="mt-0.5 text-[11px] text-bobby-faint">{selectedAgent?.sourcePath ?? 'Draft a new .bobby/agents file'}</p>
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
                disabled={!selectedAgent || saving}
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
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-bobby-faint">Model</span>
                <input
                  value={draft.model}
                  onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}
                  placeholder="deepseek-chat"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-bobby-faint">Tools</span>
                <input
                  value={draft.tools}
                  onChange={(event) => setDraft((current) => ({ ...current, tools: event.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}
                  placeholder="read_file, write_file"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-bobby-faint">Triggers</span>
                <input
                  value={draft.triggers}
                  onChange={(event) => setDraft((current) => ({ ...current, triggers: event.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}
                  placeholder="quickfix, review"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-bobby-faint">System prompt</span>
                <textarea
                  value={draft.systemPrompt}
                  onChange={(event) => setDraft((current) => ({ ...current, systemPrompt: event.target.value }))}
                  className="min-h-[260px] w-full resize-y rounded-lg border px-3 py-2 text-[13px] leading-6 outline-none"
                  style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}
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
                <div className="mb-3 flex items-center gap-2">
                  <Play className="h-4 w-4 text-bobby-muted" />
                  <h4 className="text-[13px] font-semibold text-bobby-ink">Dispatch task</h4>
                </div>
                <textarea
                  value={task}
                  onChange={(event) => setTask(event.target.value)}
                  className="min-h-[120px] w-full resize-y rounded-lg border px-3 py-2 text-[13px] leading-6 outline-none"
                  style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}
                  placeholder="What should this subagent do in an isolated worktree?"
                />
                <button
                  type="button"
                  onClick={() => void dispatchAgent()}
                  disabled={dispatching}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: 'var(--bobby-accent)' }}
                >
                  <Play className="h-3.5 w-3.5" />
                  {dispatching ? 'Dispatching...' : 'Dispatch'}
                </button>
              </section>

              <section className="rounded-xl border p-4" style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}>
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-bobby-muted" />
                  <h4 className="text-[13px] font-semibold text-bobby-ink">Recent dispatches</h4>
                </div>
                {dispatches.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-4 py-8 text-center text-[12px] text-bobby-faint" style={{ borderColor: 'var(--bobby-border-muted)' }}>
                    No dispatches yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dispatches.slice(0, 6).map((record) => (
                      <DispatchBadge key={record.id} record={record} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
