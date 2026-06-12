import React from 'react';
import {
  Bug,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileDiff,
  FolderOpen,
  Globe,
  MessageCircle,
  MonitorPlay,
  PanelRight,
  Play,
  Route,
  ShieldAlert,
  TerminalSquare,
  Trash2,
  Undo2
} from 'lucide-react';
import { useChatStore, type ChatBlock } from '../store/chat-store';
import { DiffView } from './DiffView';
import {
  makeKernelClient,
  type ProposalSummary,
  type SnapshotListEntry,
  type SubAgentDispatchRecordDto,
  type TerminalRunResult,
  type WorkspaceReadFileResult,
  type WorkspaceTreeNode
} from '../ipc/contract';

type DockTab = 'mission' | 'plan' | 'review' | 'diff' | 'terminal' | 'files' | 'browser' | 'sidechat' | 'preview' | 'tasks';

const TABS: Array<{ id: DockTab; label: string; shortcut?: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'mission', label: 'Mission Control', icon: ClipboardList },
  { id: 'plan', label: 'Plan', icon: Route },
  { id: 'review', label: 'Review', shortcut: 'Ctrl+Shift+G', icon: Bug },
  { id: 'diff', label: 'Diff', shortcut: 'Ctrl+Shift+D', icon: FileDiff },
  { id: 'terminal', label: 'Terminal', shortcut: 'Ctrl+`', icon: TerminalSquare },
  { id: 'files', label: 'Files', shortcut: 'Ctrl+P', icon: FolderOpen },
  { id: 'browser', label: 'Browser', shortcut: 'Ctrl+T', icon: Globe },
  { id: 'sidechat', label: 'Side Chat', shortcut: 'Ctrl+Alt+S', icon: MessageCircle },
  { id: 'preview', label: 'Preview', shortcut: 'Ctrl+P', icon: MonitorPlay },
  { id: 'tasks', label: 'Background Tasks', icon: Play }
];

function payloadValue(block: ChatBlock, key: string): string {
  if (block.kind !== 'evidence') return '';
  const payload = block.evidence.payload as Record<string, unknown>;
  return typeof payload[key] === 'string' ? String(payload[key]) : '';
}

function collectDiffs(blocks: ChatBlock[]): Array<{ path: string; patch: string }> {
  return blocks.flatMap((block) => {
    if (block.kind !== 'evidence' || block.evidence.evidenceType !== 'file_diff') return [];
    const path = payloadValue(block, 'path');
    const patch = payloadValue(block, 'patch');
    return path && patch ? [{ path, patch }] : [];
  });
}

function blockText(block: ChatBlock): string {
  if (block.kind === 'user' || block.kind === 'assistant' || block.kind === 'reasoning') return block.text;
  if (block.kind === 'tool') return [block.tool, block.content].filter(Boolean).join(' - ');
  if (block.kind === 'evidence') return `${block.evidence.acId} / ${block.evidence.evidenceType}`;
  if (block.kind === 'verdict') return `${block.acId}: ${block.result}`;
  if (block.kind === 'plan') return `${block.steps.length} steps / ${block.status}`;
  if (block.kind === 'status') return block.status;
  if (block.kind === 'gate') return block.reason;
  if (block.kind === 'error') return block.message;
  return '';
}

function Empty({ title }: { title: string }) {
  return <div className="px-4 py-8 text-center text-[12px] text-bobby-faint">{title}</div>;
}

function Row({ icon: Icon, title, meta, tone = 'default' }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; title: string; meta?: string; tone?: 'default' | 'danger' | 'warning' | 'success' }) {
  const color = tone === 'danger' ? 'var(--bobby-danger)' : tone === 'warning' ? '#d97706' : tone === 'success' ? 'var(--bobby-success)' : 'var(--bobby-text-muted)';
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1">
        <div className="break-words text-[12px] font-medium text-bobby-ink">{title}</div>
        {meta && <div className="mt-0.5 break-words text-[11px] text-bobby-faint">{meta}</div>}
      </div>
    </div>
  );
}

function MissionPanel() {
  const blocks = useChatStore((s) => s.blocks);
  const currentProject = useChatStore((s) => s.currentProject);
  const steps = useChatStore((s) => s.currentPlan);
  const status = useChatStore((s) => s.status);
  const taskId = useChatStore((s) => s.currentTaskId);
  const gates = blocks.filter((block) => block.kind === 'gate').length;
  const evidence = blocks.filter((block) => block.kind === 'evidence').length;
  const tools = blocks.filter((block) => block.kind === 'tool').length;
  const final = blocks.findLast((block) => block.kind === 'status');
  const finalStatus = final ? blockText(final) : status === 'done' ? 'Awaiting final status event' : 'Not accepted yet';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Row icon={ClipboardList} title={status} meta="Current task" tone={status === 'failed' ? 'danger' : status === 'done' ? 'success' : 'default'} />
        <Row icon={ShieldAlert} title={String(gates)} meta="Permission pauses" tone={gates > 0 ? 'warning' : 'default'} />
        <Row icon={TerminalSquare} title={String(tools)} meta="Tool calls" />
        <Row icon={CheckCircle2} title={String(evidence)} meta="Evidence items" />
      </div>
      <Row icon={FolderOpen} title={currentProject?.name ?? 'No project selected'} meta={currentProject?.path ?? 'Open a project to bind tasks to a workspace'} />
      <Row icon={Route} title={steps.length > 0 ? `${steps.length} plan steps` : 'No plan steps yet'} meta={steps[0]?.desc ?? 'Waiting for the agent to publish a plan'} />
      <Row icon={ClipboardList} title={taskId ?? 'No active task'} meta="Current task id" />
      <Row icon={CheckCircle2} title={finalStatus} meta="Final acceptance status" tone={final?.kind === 'status' && final.status === 'done' ? 'success' : status === 'failed' ? 'danger' : 'default'} />
    </div>
  );
}

function PlanPanel() {
  const steps = useChatStore((s) => s.currentPlan);
  if (steps.length === 0) return <Empty title="No plan emitted for this session." />;
  return <div className="space-y-2">{steps.map((step, index) => <Row key={step.id} icon={Route} title={`${index + 1}. ${step.desc}`} meta={step.satisfiesAcIds.join(', ')} />)}</div>;
}

function ReviewPanel({ proposals, refresh }: { proposals: ProposalSummary[]; refresh: () => Promise<void> }) {
  const blocks = useChatStore((s) => s.blocks);
  const status = useChatStore((s) => s.status);
  const currentProject = useChatStore((s) => s.currentProject);
  const findings = blocks.filter((block) => block.kind === 'error' || (block.kind === 'verdict' && block.result !== 'pass'));
  const gates = blocks.filter((block) => block.kind === 'gate');
  const client = React.useMemo(() => (typeof window !== 'undefined' && window.bobby ? makeKernelClient() : null), []);
  const canApply = status === 'done' && findings.length === 0 && gates.length === 0;
  const [isGitRepo, setIsGitRepo] = React.useState(false);
  const [commitMessage, setCommitMessage] = React.useState('Apply Bobby proposal');
  const [commitStatus, setCommitStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const probe = async () => {
      if (!client?.gitIsRepo || !currentProject) {
        if (active) setIsGitRepo(false);
        return;
      }
      try {
        const result = await client.gitIsRepo();
        if (active) setIsGitRepo(result);
      } catch {
        if (active) setIsGitRepo(false);
      }
    };
    void probe();
    return () => {
      active = false;
    };
  }, [client, currentProject]);

  async function applyProposal(proposal: ProposalSummary) {
    if (!client?.applyProposal) return;
    if (!window.confirm('Apply this proposal after gate, review, and human confirmation?')) return;
    await client.applyProposal({
      proposalId: proposal.proposalId,
      gatePassed: gates.length === 0,
      proReviewPassed: findings.length === 0,
      humanConfirmed: true
    });
    await refresh();
  }

  async function discardProposal(proposal: ProposalSummary) {
    if (!client?.discardProposal) return;
    await client.discardProposal({ proposalId: proposal.proposalId });
    await refresh();
  }

  async function commitChanges() {
    if (!client?.gitCommit) return;
    if (!isGitRepo) return;
    if (!window.confirm(`Commit current workspace changes?\n\n${commitMessage}`)) return;
    try {
      const result = await client.gitCommit({ message: commitMessage.trim() || 'Apply Bobby proposal' });
      setCommitStatus(result.committed ? `Committed ${result.hash ?? 'changes'}` : result.output);
    } catch (error) {
      setCommitStatus(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="space-y-3">
      {findings.length === 0 && gates.length === 0 ? <Row icon={CheckCircle2} title="No blocking review findings" tone="success" /> : null}
      {gates.map((gate) => <Row key={gate.id} icon={ShieldAlert} title={gate.reason} meta={gate.gateId} tone="warning" />)}
      {findings.map((finding) => <Row key={finding.id} icon={Bug} title={blockText(finding)} meta={finding.kind} tone="danger" />)}
      {proposals.length === 0 ? <Empty title="No proposal patches in .bobby/proposals." /> : proposals.map((proposal) => (
        <section key={proposal.proposalId} className="rounded-lg border p-2" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
          <div className="mb-2 flex items-center gap-2">
            <FileDiff className="h-3.5 w-3.5 text-bobby-muted" />
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-bobby-ink">{proposal.proposalId}</span>
            <button type="button" disabled={!canApply} onClick={() => void applyProposal(proposal)} className="rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40">Apply</button>
            <button type="button" onClick={() => void discardProposal(proposal)} className="rounded-md p-1 text-bobby-muted hover:text-bobby-danger"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          <DiffView patch={proposal.patch} maxHeight={180} />
        </section>
      ))}
      <section className="rounded-lg border p-3" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[12px] font-semibold text-bobby-ink">Git commit</div>
            <div className="text-[11px] text-bobby-faint">{isGitRepo ? 'Stage and commit current workspace changes.' : 'Select a git project to enable commits.'}</div>
          </div>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: isGitRepo ? 'var(--bobby-success-soft)' : 'var(--bobby-hover)', color: isGitRepo ? 'var(--bobby-success)' : 'var(--bobby-muted)' }}>
            {isGitRepo ? 'git repo' : 'not git'}
          </span>
        </div>
        <input
          value={commitMessage}
          onChange={(event) => setCommitMessage(event.target.value)}
          placeholder="Apply Bobby proposal"
          className="mt-2 w-full rounded-md border px-2.5 py-1.5 text-[12px] text-bobby-ink outline-none"
          style={{ background: 'var(--bobby-bg-canvas)', borderColor: 'var(--bobby-border)' }}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={!isGitRepo}
            onClick={() => void commitChanges()}
            className="rounded-md bg-accent px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-40"
          >
            Commit changes
          </button>
          {commitStatus && <span className="text-[11px] text-bobby-faint">{commitStatus}</span>}
        </div>
      </section>
    </div>
  );
}

function DiffPanel() {
  const blocks = useChatStore((s) => s.blocks);
  const currentTaskId = useChatStore((s) => s.currentTaskId);
  const client = React.useMemo(() => (typeof window !== 'undefined' && window.bobby ? makeKernelClient() : null), []);
  const diffs = collectDiffs(blocks);
  const [snapshots, setSnapshots] = React.useState<SnapshotListEntry[]>([]);
  const timelineSnapshots = React.useMemo(() => {
    if (!currentTaskId) return snapshots;
    return snapshots.filter((snapshot) => snapshot.taskId === currentTaskId);
  }, [currentTaskId, snapshots]);
  const orderedTimelineSnapshots = React.useMemo(
    () => [...timelineSnapshots].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
    [timelineSnapshots]
  );

  const refreshSnapshots = React.useCallback(async () => {
    if (!client?.listSnapshots) {
      setSnapshots([]);
      return;
    }
    try {
      setSnapshots(await client.listSnapshots());
    } catch {
      setSnapshots([]);
    }
  }, [client]);

  React.useEffect(() => {
    void refreshSnapshots();
  }, [refreshSnapshots, currentTaskId, blocks.length]);

  async function restoreSnapshot(snapshotId?: string) {
    const label = snapshotId ? `Restore checkpoint ${snapshotId}?` : 'Restore the latest checkpoint?';
    if (!window.confirm(label)) {
      return;
    }
    await client?.restoreSnapshot?.(snapshotId);
  }

  return (
    <div className="space-y-3">
      <button data-testid="checkpoint-restore-latest" type="button" onClick={() => void restoreSnapshot()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] text-bobby-ink" style={{ borderColor: 'var(--bobby-border)' }}>
        <Undo2 className="h-3.5 w-3.5" /> Undo
      </button>
      <section data-testid="checkpoint-timeline" className="rounded-lg border p-3" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[12px] font-semibold text-bobby-ink">Checkpoint timeline</h3>
          <button type="button" onClick={() => void refreshSnapshots()} className="rounded-md px-2 py-1 text-[11px] text-bobby-muted hover:bg-bobby-hover hover:text-bobby-ink">Refresh</button>
        </div>
        {orderedTimelineSnapshots.length === 0 ? (
          <Empty title="No checkpoints found yet." />
        ) : (
          <div className="space-y-2">
            {orderedTimelineSnapshots.map((snapshot, index) => (
              <div key={snapshot.id} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--bobby-border-muted)', background: 'var(--bobby-bg-canvas)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium text-bobby-ink">#{index + 1} {snapshot.id}</div>
                    <div className="mt-0.5 text-[11px] text-bobby-faint">{new Date(snapshot.createdAt).toLocaleString()}</div>
                    {(snapshot.taskId || snapshot.stepId) && (
                      <div className="mt-1 text-[11px] text-bobby-muted">
                        {snapshot.taskId ? `task ${snapshot.taskId}` : ''}
                        {snapshot.taskId && snapshot.stepId ? ' / ' : ''}
                        {snapshot.stepId ? `step ${snapshot.stepId}` : ''}
                      </div>
                    )}
                  </div>
                  <button type="button" data-testid={`checkpoint-restore-${snapshot.id}`} onClick={() => void restoreSnapshot(snapshot.id)} className="rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-white">Restore</button>
                </div>
                <div className="mt-2 text-[11px] text-bobby-faint">{snapshot.copied.length} copied / {snapshot.skipped.length} skipped</div>
              </div>
            ))}
          </div>
        )}
      </section>
      {diffs.length === 0 ? <Empty title="No file diffs yet." /> : diffs.map((diff, index) => <DiffView key={`${diff.path}-${index}`} patch={diff.patch} filePath={diff.path} maxHeight={260} />)}
    </div>
  );
}

function ToolCommand({
  kind,
  icon: Icon,
  placeholder,
  button,
  buildPrompt
}: {
  kind: string;
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  button: string;
  buildPrompt: (value: string) => string;
}) {
  const [value, setValue] = React.useState('');
  const client = React.useMemo(() => (typeof window !== 'undefined' && window.bobby ? makeKernelClient() : null), []);

  async function run() {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (kind === 'browser') {
      window.open(trimmed, '_blank', 'noopener,noreferrer');
    }
    await client?.startTask(buildPrompt(trimmed));
    setValue('');
  }

  return (
    <div className="rounded-lg border p-2.5" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}>
      <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-bobby-faint">
        <Icon className="h-3.5 w-3.5" />
        {kind}
      </label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void run();
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-md border bg-transparent px-2.5 py-1.5 text-[12px] text-bobby-ink outline-none placeholder:text-bobby-faint"
          style={{ borderColor: 'var(--bobby-border)' }}
        />
        <button type="button" onClick={() => void run()} disabled={!value.trim()} className="rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40">
          {button}
        </button>
      </div>
    </div>
  );
}

function DispatchRow({ record }: { record: SubAgentDispatchRecordDto }) {
  const palette = {
    queued: { label: 'Queued', color: 'var(--bobby-muted)', bg: 'var(--bobby-surface-subtle)' },
    running: { label: 'Running', color: 'var(--bobby-accent)', bg: 'var(--bobby-accent-soft)' },
    completed: { label: 'Done', color: 'var(--bobby-success)', bg: 'var(--bobby-success-soft)' },
    failed: { label: 'Failed', color: 'var(--bobby-danger)', bg: 'var(--bobby-danger-soft)' }
  } as const;
  const style = palette[record.status];
  const mergeLabel =
    record.mergeState === 'applied' ? 'Applied' :
    record.mergeState === 'ready' ? 'Ready' :
    record.mergeState === 'blocked' ? 'Blocked' :
    'Pending';

  return (
    <div className="rounded-lg border px-3 py-2" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: style.bg, color: style.color }}>
              {style.label}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: 'var(--bobby-chip-bg)', color: 'var(--bobby-muted)' }}>
              {mergeLabel}
            </span>
          </div>
          <div className="mt-1 truncate text-[12px] font-medium text-bobby-ink">{record.agentName}</div>
          <div className="mt-0.5 break-words text-[11px] text-bobby-faint">{record.task}</div>
          <div className="mt-1 space-y-0.5 text-[11px] text-bobby-faint">
            <div className="truncate">worktree: {record.worktreePath ?? '-'}</div>
            <div className="truncate">proposal: {record.proposalPath ?? '-'}</div>
          </div>
        </div>
        <div className="shrink-0 text-[10px] text-bobby-faint">{new Date(record.updatedAt).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}

function CommandOutputRow({ block, index }: { block: ChatBlock; index: number }) {
  if (block.kind !== 'evidence' || block.evidence.evidenceType !== 'command_output') {
    return null;
  }

  const payload = block.evidence.payload as Record<string, unknown>;
  const stdout = typeof payload.stdout === 'string' ? payload.stdout : '';
  const stderr = typeof payload.stderr === 'string' ? payload.stderr : '';
  const exitCode = typeof payload.exitCode === 'number' ? payload.exitCode : null;
  const command = typeof payload.cmd === 'string' ? payload.cmd : 'command';
  const args = Array.isArray(payload.args) ? payload.args.filter((item) => typeof item === 'string').map(String) : [];
  const label = [command, ...args].join(' ').trim();

  return (
    <article className="rounded-lg border p-3" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}>
      <div className="flex items-center justify-between gap-2 text-[11px] text-bobby-faint">
        <span className={exitCode === 0 ? 'text-bobby-success' : exitCode === null ? 'text-bobby-muted' : 'text-bobby-danger'}>
          {exitCode === null ? 'running' : `exit ${exitCode}`}
        </span>
        <span className="truncate">{label}</span>
      </div>
      {stdout && <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-bobby-surface-subtle px-3 py-2 text-[12px] leading-5 text-bobby-ink">{stdout}</pre>}
      {stderr && <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-bobby-danger-soft px-3 py-2 text-[12px] leading-5 text-bobby-danger">{stderr}</pre>}
      <div className="mt-2 text-[10px] text-bobby-faint">step {index + 1}</div>
    </article>
  );
}

function TerminalPanel() {
  const client = React.useMemo(() => (typeof window !== 'undefined' && window.bobby ? makeKernelClient() : null), []);
  const blocks = useChatStore((state) => state.blocks);
  const [command, setCommand] = React.useState('');
  const [runs, setRuns] = React.useState<TerminalRunResult[]>([]);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const commandOutputs = React.useMemo(
    () => blocks.filter((block): block is Extract<ChatBlock, { kind: 'evidence' }> => block.kind === 'evidence' && block.evidence.evidenceType === 'command_output'),
    [blocks]
  );

  async function runCommand() {
    if (!client?.runTerminalCommand || !command.trim()) return;
    if (!window.confirm(`Run command in the current workspace?\n\n${command.trim()}`)) {
      return;
    }

    setRunning(true);
    setError(null);
    try {
      const result = await client.runTerminalCommand({ command: command.trim(), confirmed: true });
      setRuns((current) => [result, ...current].slice(0, 12));
      setCommand('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-2.5" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}>
        <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-bobby-faint">
          <TerminalSquare className="h-3.5 w-3.5" />
          Terminal
        </label>
        <div className="flex gap-2">
          <input
            data-testid="terminal-command-input"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void runCommand();
              }
            }}
            placeholder="pnpm test, git status, node script..."
            className="min-w-0 flex-1 rounded-md border bg-transparent px-2.5 py-1.5 text-[12px] text-bobby-ink outline-none placeholder:text-bobby-faint"
            style={{ borderColor: 'var(--bobby-border)' }}
          />
          <button type="button" onClick={() => void runCommand()} disabled={running || !command.trim()} className="rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40">
            {running ? 'Running...' : 'Run'}
          </button>
        </div>
        {error && <div className="mt-2 rounded-md px-3 py-2 text-[12px]" style={{ background: 'var(--bobby-danger-soft)', color: 'var(--bobby-danger)' }}>{error}</div>}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}>
          <div>
            <div className="text-[12px] font-semibold text-bobby-ink">Task stream</div>
            <div className="text-[11px] text-bobby-faint">Real command output evidence from the current session.</div>
          </div>
          <div className="text-[11px] text-bobby-faint">{commandOutputs.length} item{commandOutputs.length === 1 ? '' : 's'}</div>
        </div>
        {commandOutputs.length === 0 ? (
          <Empty title="No command output evidence yet." />
        ) : (
          <div className="space-y-2">
            {commandOutputs.map((block, index) => (
              <CommandOutputRow key={block.id} block={block} index={index} />
            ))}
          </div>
        )}
      </section>

      {runs.length === 0 ? (
        <Empty title="No terminal commands yet." />
      ) : (
        <div className="space-y-2">
          {runs.map((run, index) => {
            const payload = (run.evidence[0] as { payload?: Record<string, unknown> } | undefined)?.payload ?? {};
            const stdout = typeof payload.stdout === 'string' ? payload.stdout : '';
            const stderr = typeof payload.stderr === 'string' ? payload.stderr : '';
            const exitCode = typeof payload.exitCode === 'number' ? payload.exitCode : run.result.exitCode;
            return (
              <div key={`${index}-${exitCode}`} className="rounded-lg border p-3" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}>
                <div className="flex items-center justify-between gap-2 text-[11px] text-bobby-faint">
                  <span className={exitCode === 0 ? 'text-bobby-success' : 'text-bobby-danger'}>exit {exitCode}</span>
                  <span>{typeof payload.cmd === 'string' ? String(payload.cmd) : 'command'}</span>
                </div>
                {stdout && <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-bobby-surface-subtle px-3 py-2 text-[12px] leading-5 text-bobby-ink">{stdout}</pre>}
                {stderr && <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-bobby-danger-soft px-3 py-2 text-[12px] leading-5 text-bobby-danger">{stderr}</pre>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FileTreeNode({
  node,
  selectedPath,
  onSelect
}: {
  node: WorkspaceTreeNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  if (node.kind === 'file') {
    return (
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-bobby-hover"
        style={selectedPath === node.path ? { background: 'var(--bobby-accent-soft)' } : undefined}
      >
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-bobby-faint" />
        <span className="min-w-0 truncate text-bobby-ink">{node.name}</span>
      </button>
    );
  }

  return (
    <details open className="rounded-md px-1 py-0.5">
      <summary className="cursor-pointer list-none rounded-md px-1.5 py-1 text-[12px] font-medium text-bobby-ink hover:bg-bobby-hover">{node.name}</summary>
      <div className="ml-3 border-l border-bobby-border-muted pl-2">
        {node.children?.map((child) => (
          <FileTreeNode key={child.path} node={child} selectedPath={selectedPath} onSelect={onSelect} />
        ))}
      </div>
    </details>
  );
}

function FilesPanel() {
  const client = React.useMemo(() => (typeof window !== 'undefined' && window.bobby ? makeKernelClient() : null), []);
  const [tree, setTree] = React.useState<WorkspaceTreeNode[]>([]);
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
  const [pathInput, setPathInput] = React.useState('');
  const [file, setFile] = React.useState<WorkspaceReadFileResult | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!client?.listWorkspaceTree) {
      setTree([]);
      return;
    }

    setLoading(true);
    try {
      const next = await client.listWorkspaceTree();
      setTree(next);
      if (!selectedPath) {
        const firstFile = findFirstFile(next);
        if (firstFile) {
          setSelectedPath(firstFile.path);
          setFile(client.readWorkspaceFile ? await client.readWorkspaceFile(firstFile.path) : null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [client, selectedPath]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function selectPath(path: string) {
    setSelectedPath(path);
    if (!client?.readWorkspaceFile) {
      setFile(null);
      return;
    }
    setFile(await client.readWorkspaceFile(path));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}>
        <div>
          <div className="text-[12px] font-semibold text-bobby-ink">Workspace tree</div>
          <div className="text-[11px] text-bobby-faint">{loading ? 'Loading...' : 'Click a file to preview contents'}</div>
        </div>
        <button type="button" onClick={() => void refresh()} className="rounded-md px-2 py-1 text-[11px] text-bobby-muted hover:bg-bobby-hover hover:text-bobby-ink">Refresh</button>
      </div>

      <div className="rounded-lg border p-2.5" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}>
        <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-bobby-faint">
          <FolderOpen className="h-3.5 w-3.5" />
          Open path
        </label>
        <div className="flex gap-2">
          <input
            data-testid="files-search-input"
            value={pathInput}
            onChange={(event) => setPathInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void selectPath(pathInput.trim());
              }
            }}
            placeholder="src/file.ts"
            className="min-w-0 flex-1 rounded-md border bg-transparent px-2.5 py-1.5 text-[12px] text-bobby-ink outline-none placeholder:text-bobby-faint"
            style={{ borderColor: 'var(--bobby-border)' }}
          />
          <button type="button" onClick={() => void selectPath(pathInput.trim())} disabled={!pathInput.trim()} className="rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40">
            Open
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div data-testid="files-tree" className="max-h-[520px] overflow-y-auto rounded-lg border p-2" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}>
          {tree.length === 0 ? <Empty title="No files found." /> : tree.map((node) => <FileTreeNode key={node.path} node={node} selectedPath={selectedPath} onSelect={(path) => void selectPath(path)} />)}
        </div>
        <div className="min-w-0 rounded-lg border p-3" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}>
          {file ? (
            <>
              <div className="mb-2 text-[11px] text-bobby-faint">{file.path}</div>
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md bg-bobby-surface-subtle px-3 py-2 text-[12px] leading-5 text-bobby-ink">{file.content}</pre>
            </>
          ) : (
            <Empty title="Select a file to inspect its text content." />
          )}
        </div>
      </div>
    </div>
  );
}

function findFirstFile(nodes: WorkspaceTreeNode[]): WorkspaceTreeNode | null {
  for (const node of nodes) {
    if (node.kind === 'file') return node;
    const nested = node.children ? findFirstFile(node.children) : null;
    if (nested) return nested;
  }
  return null;
}

type PreviewSuggestion = {
  packageManager: 'pnpm' | 'npm' | 'yarn' | 'bun';
  command: string | null;
  url: string;
  note: string;
};

function parsePackageJson(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function detectPackageManager(packageJson: Record<string, unknown> | null): PreviewSuggestion['packageManager'] {
  const raw = typeof packageJson?.packageManager === 'string' ? packageJson.packageManager.toLowerCase() : '';
  if (raw.startsWith('npm')) return 'npm';
  if (raw.startsWith('yarn')) return 'yarn';
  if (raw.startsWith('bun')) return 'bun';
  return 'pnpm';
}

function detectPreviewUrl(scriptText: string | null): string {
  const text = (scriptText ?? '').toLowerCase();
  if (/storybook/.test(text)) return 'http://localhost:6006';
  if (/next/.test(text) || /remix/.test(text) || /nuxt/.test(text)) return 'http://localhost:3000';
  if (/astro/.test(text)) return 'http://localhost:4321';
  if (/vite/.test(text) || /sveltekit/.test(text) || /parcel/.test(text) || /webpack/.test(text)) return 'http://localhost:5173';
  return 'http://localhost:3000';
}

function buildLaunchCommand(packageManager: PreviewSuggestion['packageManager'], scriptName: 'dev' | 'start'): string {
  if (packageManager === 'npm') {
    return `npm run ${scriptName}`;
  }
  if (packageManager === 'bun') {
    return `bun run ${scriptName}`;
  }
  return `${packageManager} ${scriptName}`;
}

function buildPreviewSuggestion(packageJsonText: string | null): PreviewSuggestion {
  const packageJson = parsePackageJson(packageJsonText);
  const scripts = packageJson && typeof packageJson.scripts === 'object' && packageJson.scripts !== null
    ? (packageJson.scripts as Record<string, unknown>)
    : {};
  const scriptName = typeof scripts.dev === 'string' ? 'dev' : typeof scripts.start === 'string' ? 'start' : null;
  const scriptText = scriptName ? String(scripts[scriptName]) : null;
  const packageManager = detectPackageManager(packageJson);
  const command = scriptName ? buildLaunchCommand(packageManager, scriptName) : null;
  const url = detectPreviewUrl(scriptText);

  return {
    packageManager,
    command,
    url,
    note: scriptName ? `Detected ${scriptName} script from package.json.` : 'No dev or start script detected in package.json.'
  };
}

function PreviewPanel() {
  const currentProject = useChatStore((s) => s.currentProject);
  const client = React.useMemo(() => (typeof window !== 'undefined' && window.bobby ? makeKernelClient() : null), []);
  const [url, setUrl] = React.useState('http://localhost:5174');
  const [activeUrl, setActiveUrl] = React.useState('http://localhost:5174');
  const [suggestion, setSuggestion] = React.useState<PreviewSuggestion>({
    packageManager: 'pnpm',
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    note: 'Waiting for project detection.'
  });
  const [launching, setLaunching] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    if (!client?.readWorkspaceFile || !currentProject) {
      setSuggestion({
        packageManager: 'pnpm',
        command: null,
        url: 'http://localhost:5173',
        note: currentProject ? 'No package.json available for preview detection.' : 'Open a project to detect a dev server.'
      });
      return () => {
        active = false;
      };
    }

    void client.readWorkspaceFile('package.json')
      .then((file) => {
        if (!active) return;
        const nextSuggestion = buildPreviewSuggestion(file?.content ?? null);
        setSuggestion(nextSuggestion);
        setUrl(nextSuggestion.url);
        setActiveUrl(nextSuggestion.url);
      })
      .catch(() => {
        if (!active) return;
        setSuggestion({
          packageManager: 'pnpm',
          command: null,
          url: 'http://localhost:5173',
          note: 'Failed to inspect package.json for preview detection.'
        });
      });

    return () => {
      active = false;
    };
  }, [client, currentProject]);

  async function startPreviewServer() {
    if (!client?.startPreviewServer || !suggestion.command) return;

    if (!window.confirm(`Start the local preview server?\n\n${suggestion.command}\n\nOpen ${suggestion.url} after launch?`)) {
      return;
    }

    setLaunching(true);
    setStatus(null);
    try {
      const result = await client.startPreviewServer({ command: suggestion.command, url: suggestion.url, confirmed: true });
      setActiveUrl(result.url);
      setUrl(result.url);
      setStatus(`Started ${result.command} and opened ${result.url}.`);
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-2.5" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}>
        <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-bobby-faint">
          <MonitorPlay className="h-3.5 w-3.5" />
          Preview
        </label>
        <div className="flex gap-2">
          <input
            data-testid="preview-url-input"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                setActiveUrl(url.trim());
              }
            }}
            placeholder="http://localhost:5174"
            className="min-w-0 flex-1 rounded-md border bg-transparent px-2.5 py-1.5 text-[12px] text-bobby-ink outline-none placeholder:text-bobby-faint"
            style={{ borderColor: 'var(--bobby-border)' }}
          />
          <button data-testid="preview-open-button" type="button" onClick={() => setActiveUrl(url.trim())} className="rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white">
            Open
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            data-testid="preview-start-button"
            type="button"
            onClick={() => void startPreviewServer()}
            disabled={launching || !suggestion.command}
            className="rounded-md border px-2.5 py-1.5 text-[12px] font-medium text-bobby-ink disabled:opacity-40"
            style={{ borderColor: 'var(--bobby-border)' }}
          >
            {launching ? 'Starting...' : 'Start dev server'}
          </button>
          <span className="text-[11px] text-bobby-faint">{suggestion.note}</span>
        </div>
        <div className="mt-1 text-[11px] text-bobby-faint">
          Command: {suggestion.command ?? 'No launch command detected'} · Port hint: {suggestion.url}
        </div>
        {status && <div className="mt-2 rounded-md px-3 py-2 text-[11px] text-bobby-muted" style={{ background: 'var(--bobby-surface-subtle)' }}>{status}</div>}
      </div>
      <iframe
        title="Preview"
        src={activeUrl}
        className="min-h-[520px] w-full rounded-lg border"
        style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border-muted)' }}
      />
      <div className="text-[11px] text-bobby-faint">Active preview: {activeUrl || 'none'}</div>
    </div>
  );
}

function ToolPanel({ kind }: { kind: 'terminal' | 'browser' | 'tasks' | 'sidechat' | 'preview' | 'files' }) {
  const blocks = useChatStore((s) => s.blocks);
  const [dispatches, setDispatches] = React.useState<SubAgentDispatchRecordDto[]>([]);
  React.useEffect(() => {
    if (kind !== 'tasks') return;
    const client = typeof window !== 'undefined' && window.bobby ? makeKernelClient() : null;
    let active = true;

    const refresh = async () => {
      if (!client?.listSubAgentDispatches) {
        if (active) setDispatches([]);
        return;
      }

      try {
        const next = await client.listSubAgentDispatches();
        if (active) setDispatches(next);
      } catch {
        if (active) setDispatches([]);
      }
    };

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 4000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [kind]);

  if (kind === 'terminal') return <TerminalPanel />;
  if (kind === 'files') return <FilesPanel />;
  if (kind === 'preview') return <PreviewPanel />;
  if (kind === 'tasks') {
    return (
      <div className="space-y-3">
        {dispatches.length === 0 ? (
          <Empty title="No background tasks dispatched yet." />
        ) : (
          <div className="space-y-2">
            {dispatches.map((record) => <DispatchRow key={record.id} record={record} />)}
          </div>
        )}
      </div>
    );
  }
  const command =
    kind === 'browser' ? <ToolCommand kind="Browser" icon={Globe} placeholder="https://example.com or http://localhost:5174" button="Open" buildPrompt={(value) => `Open and inspect this web page, then report visible evidence: ${value}`} /> :
    kind === 'sidechat' ? <ToolCommand kind="Side Chat" icon={MessageCircle} placeholder="Ask a side question without changing the main mission..." button="Ask" buildPrompt={(value) => `Side chat for the current session: ${value}`} /> :
    null;
  const filtered = blocks.filter((block) => {
    if (kind === 'browser') return block.kind === 'tool' && /browser|chrome|playwright|url|http/i.test(block.tool);
    if (kind === 'sidechat') return block.kind === 'user' || block.kind === 'assistant' || block.kind === 'reasoning';
    return block.kind === 'evidence';
  });
  const icon = kind === 'browser' ? Globe : MessageCircle;
  return <div className="space-y-2">{command}{filtered.length === 0 ? <Empty title="No session data for this panel yet." /> : filtered.map((block) => <Row key={block.id} icon={icon} title={blockText(block)} meta={block.kind} />)}</div>;
}

export function SessionToolDock() {
  const [open, setOpen] = React.useState(true);
  const [tab, setTab] = React.useState<DockTab>('mission');
  const [proposals, setProposals] = React.useState<ProposalSummary[]>([]);
  const client = React.useMemo(() => (typeof window !== 'undefined' && window.bobby ? makeKernelClient() : null), []);

  const refreshProposals = React.useCallback(async () => {
    if (!client?.listProposals) return;
    try {
      setProposals(await client.listProposals());
    } catch {
      setProposals([]);
    }
  }, [client]);

  React.useEffect(() => {
    void refreshProposals();
  }, [refreshProposals]);

  const active = TABS.find((item) => item.id === tab) ?? TABS[0];
  const ActiveIcon = active.icon;
  const content =
    tab === 'mission' ? <MissionPanel /> :
    tab === 'plan' ? <PlanPanel /> :
    tab === 'review' ? <ReviewPanel proposals={proposals} refresh={refreshProposals} /> :
    tab === 'diff' ? <DiffPanel /> :
    <ToolPanel kind={tab} />;

  return (
    <aside className="flex h-full shrink-0 border-l" style={{ background: 'var(--bobby-bg-canvas)', borderColor: 'var(--bobby-border)' }}>
      <nav className="flex w-12 flex-col items-center gap-1 overflow-y-auto border-r px-1.5 py-2" style={{ borderColor: 'var(--bobby-border-muted)', background: 'var(--bobby-surface-elevated)' }}>
        <button type="button" onClick={() => setOpen((value) => !value)} className="mb-1 rounded-md p-1.5 text-bobby-muted hover:bg-bobby-hover hover:text-bobby-ink" title={open ? 'Collapse dock' : 'Open dock'}>
          {open ? <ChevronRight className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
        </button>
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" onClick={() => { setTab(item.id); setOpen(true); }} title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label} className="rounded-md p-1.5 text-bobby-muted hover:bg-bobby-hover hover:text-bobby-ink" style={tab === item.id ? { background: 'var(--bobby-accent-soft)', color: 'var(--bobby-accent)' } : undefined}>
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </nav>
      {open && (
        <section className="flex w-[380px] min-w-0 flex-col">
          <header className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
            <ActiveIcon className="h-4 w-4 text-bobby-muted" />
            <div className="min-w-0 flex-1">
              <h2 data-testid="dock-active-tab" className="truncate text-[13px] font-semibold text-bobby-ink">{active.label}</h2>
              <p className="truncate text-[11px] text-bobby-faint">{active.shortcut ?? 'Current session panel'}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-bobby-muted hover:bg-bobby-hover hover:text-bobby-ink"><ChevronLeft className="h-4 w-4" /></button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{content}</div>
        </section>
      )}
    </aside>
  );
}
