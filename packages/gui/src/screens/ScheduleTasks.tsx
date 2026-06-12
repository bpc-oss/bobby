import React from 'react';
import { Check, Clock3, Plus, Play, RefreshCw, Trash2 } from 'lucide-react';
import { makeKernelClient, type AutomationRecord } from '../ipc/contract';

type AutomationDraft = {
  title: string;
  kind: AutomationRecord['kind'];
  prompt: string;
  intervalMinutes: string;
};

function resolveClient() {
  if (typeof window === 'undefined' || window.bobby === undefined) {
    return null;
  }

  return makeKernelClient();
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function openAutomationHistory(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent('bobby:navigate', { detail: { page: 'history' } }));
}

export function ScheduleTasks() {
  const client = React.useMemo(resolveClient, []);
  const [items, setItems] = React.useState<AutomationRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<AutomationDraft>({
    title: '',
    kind: 'schedule',
    prompt: 'Check in on the current Bobby session and summarize what changed.',
    intervalMinutes: '60'
  });

  const refresh = React.useCallback(async () => {
    if (!client?.listAutomations) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setItems(await client.listAutomations());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, [client]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAutomation = React.useCallback(async () => {
    if (!client?.createAutomation) {
      return;
    }

    const intervalMinutes = Number.parseInt(draft.intervalMinutes, 10);
    if (!draft.title.trim() || !draft.prompt.trim() || !Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
      setError('Fill in title, prompt, and interval minutes.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await client.createAutomation({
        title: draft.title.trim(),
        kind: draft.kind,
        prompt: draft.prompt.trim(),
        intervalMinutes
      });
      setDraft((current) => ({ ...current, title: '' }));
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSaving(false);
    }
  }, [client, draft, refresh]);

  const toggleAutomation = React.useCallback(async (id: string) => {
    if (!client?.toggleAutomation) return;
    setError(null);
    try {
      await client.toggleAutomation({ id });
      await refresh();
    } catch (nextError) {
      setError(formatError(nextError));
    }
  }, [client, refresh]);

  const removeAutomation = React.useCallback(async (id: string) => {
    if (!client?.removeAutomation) return;
    setError(null);
    try {
      await client.removeAutomation({ id });
      await refresh();
    } catch (nextError) {
      setError(formatError(nextError));
    }
  }, [client, refresh]);

  const runAutomationNow = React.useCallback(async (id: string) => {
    if (!client?.runAutomationNow) return;
    setError(null);
    try {
      await client.runAutomationNow({ id });
      await refresh();
    } catch (nextError) {
      setError(formatError(nextError));
    }
  }, [client, refresh]);

  return (
    <div className="flex h-full flex-col bg-bobby-canvas">
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <div>
          <h2 className="text-[13px] font-semibold text-bobby-ink">Automations</h2>
          <p className="mt-0.5 text-[11px] text-bobby-faint">Local recurring tasks, reminders, and follow-ups.</p>
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

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-4 py-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="min-w-0 rounded-xl border p-4" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-bobby-muted" />
            <h3 className="text-[13px] font-semibold text-bobby-ink">New automation</h3>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-bobby-faint">Title</span>
              <input
                data-testid="automation-title-input"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}
                placeholder="Daily code review"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-bobby-faint">Kind</span>
              <select
                data-testid="automation-kind-select"
                value={draft.kind}
                onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as AutomationRecord['kind'] }))}
                className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}
              >
                <option value="schedule">Schedule</option>
                <option value="reminder">Reminder</option>
                <option value="monitor">Monitor</option>
                <option value="follow-up">Follow-up</option>
                <option value="wake">Wake</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-bobby-faint">Prompt</span>
              <textarea
                data-testid="automation-prompt-input"
                value={draft.prompt}
                onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))}
                className="min-h-[120px] w-full resize-none rounded-lg border px-3 py-2 text-[13px] leading-5 outline-none"
                style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}
                placeholder="What should Bobby do when this automation fires?"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-bobby-faint">Every (minutes)</span>
              <input
                data-testid="automation-interval-input"
                type="number"
                min={1}
                step={1}
                value={draft.intervalMinutes}
                onChange={(event) => setDraft((current) => ({ ...current, intervalMinutes: event.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}
              />
            </label>

            <button
              data-testid="automation-create-button"
              type="button"
              onClick={() => void createAutomation()}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'var(--bobby-accent)' }}
            >
              <Plus className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Create'}
            </button>

            {error && (
              <div className="rounded-lg border px-3 py-2 text-[12px] text-bobby-danger" style={{ background: 'var(--bobby-danger-soft)', borderColor: 'var(--bobby-danger-soft)' }}>
                {error}
              </div>
            )}

            <div className="rounded-lg border px-3 py-2 text-[12px] text-bobby-muted" style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}>
              Automations are stored locally in the desktop app and can fire even after you switch tabs.
            </div>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--bobby-border-muted)' }}>
            <div>
              <h3 className="text-[13px] font-semibold text-bobby-ink">Enabled list</h3>
              <p className="mt-0.5 text-[11px] text-bobby-faint">
                {loading ? 'Loading automations...' : `${items.length} automation${items.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px]" style={{ background: 'var(--bobby-surface-subtle)', color: 'var(--bobby-muted)' }}>
              <Clock3 className="h-3.5 w-3.5" />
              Background runner
            </div>
          </div>

          <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-3">
            {items.length === 0 && !loading && (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-[13px] text-bobby-faint" style={{ borderColor: 'var(--bobby-border-muted)' }}>
                No automations yet. Create one on the left.
              </div>
            )}

            <div className="space-y-2">
              {items.map((item) => (
                <article key={item.id} className="rounded-xl border px-4 py-3" style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}>
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => void toggleAutomation(item.id)}
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition"
                      style={{
                        background: item.enabled ? 'var(--bobby-accent)' : 'transparent',
                        borderColor: item.enabled ? 'var(--bobby-accent)' : 'var(--bobby-border)'
                      }}
                      title={item.enabled ? 'Disable' : 'Enable'}
                    >
                      {item.enabled && <Check className="h-3 w-3 text-white" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-[13px] font-semibold text-bobby-ink">{item.title}</h4>
                        <span className="rounded-full px-2 py-0.5 text-[11px] uppercase tracking-[0.14em]" style={{ background: 'var(--bobby-chip-bg)', color: 'var(--bobby-muted)' }}>
                          {item.kind}
                        </span>
                      </div>
                      <p
                        className="mt-1 text-[12px] leading-5 text-bobby-muted"
                        style={{
                          display: '-webkit-box',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          overflow: 'hidden'
                        }}
                      >
                        {item.prompt}
                      </p>
                      <div className="mt-2 grid gap-1 text-[11px] text-bobby-faint sm:grid-cols-2">
                        <div>Every {item.intervalMinutes} min</div>
                        <div>Next: {formatDateTime(item.nextRunAt)}</div>
                        <div>Last: {formatDateTime(item.lastRunAt)}</div>
                        <div>Updated: {formatDateTime(item.updatedAt)}</div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {item.lastRunAt ? (
                        <button
                          type="button"
                          onClick={openAutomationHistory}
                          className="inline-flex h-8 items-center rounded-lg px-2.5 text-[12px] font-medium text-bobby-muted transition hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
                        >
                          View history
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void runAutomationNow(item.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-bobby-muted transition hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
                        title="Run now"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeAutomation(item.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-bobby-muted transition hover:bg-bobby-danger-soft hover:text-bobby-danger"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
