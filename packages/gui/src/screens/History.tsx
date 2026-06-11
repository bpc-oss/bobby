import React from 'react';
import { CheckCircle2, FileText, Loader2, RefreshCw, Route, TerminalSquare } from 'lucide-react';
import type { TaskDetail, TaskSummary } from '../ipc/contract';

type ReplayTone = 'default' | 'success' | 'warning' | 'danger';
type ReplayRow = {
  key: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  meta: string;
  tone: ReplayTone;
};

function short(value: string, limit = 76): string {
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function payloadDetail(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  const parts = Object.entries(record)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    .map(([key, value]) => `${key}: ${String(value)}`);
  return parts.join(' / ');
}

function ReplayRows({ trace }: { trace: unknown[] }) {
  const rows: ReplayRow[] = trace.flatMap((event, index): ReplayRow[] => {
    if (!event || typeof event !== 'object') return [];
    const item = event as Record<string, unknown>;
    if (item.type === 'tool_called') {
      return [{ key: `${index}-tool`, icon: TerminalSquare, title: String(item.tool ?? 'tool'), meta: String(item.stepId ?? 'tool call'), tone: 'default' as const }];
    }
    if (item.type === 'evidence_produced' && item.evidence && typeof item.evidence === 'object') {
      const evidence = item.evidence as Record<string, unknown>;
      return [{
        key: `${index}-evidence`,
        icon: CheckCircle2,
        title: `${String(evidence.acId ?? 'AC')} / ${String(evidence.evidenceType ?? 'evidence')}`,
        meta: payloadDetail(evidence.payload),
        tone: 'success' as const
      }];
    }
    if (item.type === 'final_result') {
      return [{ key: `${index}-final`, icon: CheckCircle2, title: `Final status: ${String(item.status ?? 'unknown')}`, meta: String(item.taskId ?? ''), tone: item.status === 'done' ? 'success' as const : 'warning' as const }];
    }
    if (item.type === 'error') {
      return [{ key: `${index}-error`, icon: FileText, title: String(item.message ?? 'Error'), meta: String(item.taskId ?? ''), tone: 'danger' as const }];
    }
    return [];
  });

  if (rows.length === 0) return null;

  return (
    <section className="rounded-lg border p-4" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
      <h2 className="mb-3 text-[13px] font-semibold text-bobby-ink">Replay</h2>
      <div className="space-y-2">
        {rows.map((row) => {
          const Icon = row.icon;
          const color = row.tone === 'danger' ? 'var(--bobby-danger)' : row.tone === 'warning' ? '#d97706' : row.tone === 'success' ? 'var(--bobby-success)' : 'var(--bobby-text-muted)';
          return (
            <div key={row.key} className="flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--bobby-border-muted)', background: 'var(--bobby-bg-canvas)' }}>
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color }} />
              <div className="min-w-0">
                <div className="break-words text-[12px] font-semibold text-bobby-ink">{row.title}</div>
                {row.meta && <div className="mt-0.5 break-words text-[11px] text-bobby-faint">{row.meta}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function History({ onResumeTask }: { onResumeTask?: (sessionId: string) => void } = {}): JSX.Element {
  const [tasks, setTasks] = React.useState<TaskSummary[]>([]);
  const [detail, setDetail] = React.useState<TaskDetail | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (nextSelected = selected) => {
    if (!window.bobby?.listTasks) return;
    setLoading(true);
    setError(null);
    try {
      const nextTasks = await window.bobby.listTasks();
      const nextId = nextSelected ?? nextTasks[0]?.taskId ?? null;
      setTasks(nextTasks);
      setSelected(nextId);
      setDetail(nextId && window.bobby.readTask ? await window.bobby.readTask(nextId) : null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, [selected]);

  React.useEffect(() => {
    void load(null);
  }, [load]);

  async function openTask(taskId: string) {
    setSelected(taskId);
    await load(taskId);
  }

  return (
    <section className="flex h-full min-h-0 bg-bobby-canvas">
      <aside className="flex w-[340px] shrink-0 flex-col border-r" style={{ borderColor: 'var(--bobby-border)' }}>
        <header className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--bobby-border-muted)' }}>
          <div>
            <h2 className="text-[14px] font-semibold text-bobby-ink">History</h2>
            <p className="text-[11px] text-bobby-muted">TaskStore-backed replay</p>
          </div>
          <button type="button" data-testid="history-refresh" onClick={() => void load()} className="rounded-md p-1.5 text-bobby-muted hover:bg-bobby-hover hover:text-bobby-ink">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {error && <div className="mb-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: 'var(--bobby-danger-soft)', color: 'var(--bobby-danger)' }}>{error}</div>}
          {tasks.length === 0 && !loading ? <p className="px-2 py-6 text-center text-[12px] text-bobby-faint">No persisted tasks found.</p> : null}
          {tasks.map((task) => (
            <button key={task.taskId} type="button" data-testid={`history-task-${task.taskId}`} onClick={() => void openTask(task.taskId)} className="mb-1 w-full rounded-lg px-3 py-2 text-left hover:bg-bobby-hover" style={selected === task.taskId ? { background: 'var(--bobby-accent-soft)' } : undefined}>
              <div className="truncate text-[12px] font-semibold text-bobby-ink">{short(task.userGoal)}</div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-bobby-faint">
                <span>{task.state}</span>
                <span>{task.traceCount} events</span>
                <span>{new Date(task.updatedAt).toLocaleString()}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto p-5">
        {!detail ? (
          <div className="flex h-full items-center justify-center text-[13px] text-bobby-faint">Select a task to replay.</div>
        ) : (
          <div className="mx-auto max-w-[920px] space-y-4">
            <section className="rounded-lg border p-4" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-bobby-muted" />
                <div className="min-w-0">
                  <h1 className="break-words text-[15px] font-semibold text-bobby-ink">{detail.summary.userGoal}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-bobby-muted">
                    <span>{detail.summary.taskId}</span>
                    <span>/</span>
                    <span>{detail.summary.state}</span>
                    {detail.sessionIds[0] && onResumeTask && (
                      <>
                        <span>/</span>
                        <button
                          type="button"
                          data-testid="history-continue"
                          onClick={() => onResumeTask(detail.sessionIds[0])}
                          className="rounded-md px-2 py-0.5 text-[11px] font-medium text-bobby-ink hover:bg-bobby-hover"
                          style={{ background: 'var(--bobby-accent-soft)' }}
                        >
                          Continue
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>
            <section className="grid grid-cols-3 gap-2">
              <Metric label="Contract" value={detail.summary.hasContract ? 'yes' : 'no'} />
              <Metric label="Plan" value={detail.summary.hasPlan ? 'yes' : 'no'} />
              <Metric label="Report" value={detail.summary.hasReport ? 'yes' : 'no'} />
            </section>
            {detail.plan && (
              <section className="rounded-lg border p-4" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
                <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-bobby-ink"><Route className="h-4 w-4" /> Plan</h2>
                <div className="space-y-2">{detail.plan.map((step, index) => <div key={step.id} className="rounded-md bg-bobby-surface-subtle px-3 py-2 text-[12px] text-bobby-ink">{index + 1}. {step.desc}</div>)}</div>
              </section>
            )}
            <ReplayRows trace={detail.trace} />
            {detail.report && <pre className="max-h-[360px] overflow-auto rounded-lg border p-4 text-[12px] leading-6 text-bobby-ink" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>{detail.report}</pre>}
            <pre className="max-h-[360px] overflow-auto rounded-lg border p-4 text-[11px] leading-5 text-bobby-muted" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>{JSON.stringify(detail.trace, null, 2)}</pre>
          </div>
        )}
      </main>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
      <div className="text-[13px] font-semibold text-bobby-ink">{value}</div>
      <div className="text-[11px] text-bobby-faint">{label}</div>
    </div>
  );
}
