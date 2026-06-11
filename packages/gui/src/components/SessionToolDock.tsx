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
import { makeKernelClient, type ProposalSummary } from '../ipc/contract';

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

function collectFiles(blocks: ChatBlock[]): Array<{ path: string; exists: boolean }> {
  return blocks.flatMap((block) => {
    if (block.kind !== 'evidence' || block.evidence.evidenceType !== 'file_exists') return [];
    const payload = block.evidence.payload as Record<string, unknown>;
    return typeof payload.path === 'string' ? [{ path: payload.path, exists: Boolean(payload.exists) }] : [];
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
  const findings = blocks.filter((block) => block.kind === 'error' || (block.kind === 'verdict' && block.result !== 'pass'));
  const gates = blocks.filter((block) => block.kind === 'gate');
  const client = React.useMemo(() => (typeof window !== 'undefined' && window.bobby ? makeKernelClient() : null), []);
  const canApply = status === 'done' && findings.length === 0 && gates.length === 0;

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
    </div>
  );
}

function DiffPanel() {
  const blocks = useChatStore((s) => s.blocks);
  const client = React.useMemo(() => (typeof window !== 'undefined' && window.bobby ? makeKernelClient() : null), []);
  const diffs = collectDiffs(blocks);
  return (
    <div className="space-y-3">
      <button type="button" onClick={() => void client?.restoreSnapshot?.()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] text-bobby-ink" style={{ borderColor: 'var(--bobby-border)' }}>
        <Undo2 className="h-3.5 w-3.5" /> Undo
      </button>
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

function ToolPanel({ kind }: { kind: 'terminal' | 'browser' | 'tasks' | 'sidechat' | 'preview' | 'files' }) {
  const blocks = useChatStore((s) => s.blocks);
  const command =
    kind === 'terminal' ? <ToolCommand kind="Terminal" icon={TerminalSquare} placeholder="pnpm test, git status, node script..." button="Run" buildPrompt={(value) => `Run this terminal command from the current project and show command_output evidence: ${value}`} /> :
    kind === 'browser' ? <ToolCommand kind="Browser" icon={Globe} placeholder="https://example.com or http://localhost:5174" button="Open" buildPrompt={(value) => `Open and inspect this web page, then report visible evidence: ${value}`} /> :
    kind === 'sidechat' ? <ToolCommand kind="Side Chat" icon={MessageCircle} placeholder="Ask a side question without changing the main mission..." button="Ask" buildPrompt={(value) => `Side chat for the current session: ${value}`} /> :
    kind === 'preview' ? <ToolCommand kind="Preview" icon={MonitorPlay} placeholder="Preview URL, file path, or artifact id..." button="Preview" buildPrompt={(value) => `Preview this artifact or URL and summarize what changed: ${value}`} /> :
    kind === 'tasks' ? <ToolCommand kind="Background Task" icon={Play} placeholder="Queue a parallel/background task..." button="Start" buildPrompt={(value) => `Start this as a background task. If it changes files, isolate it in a worktree and return a patch proposal linked to this session: ${value}`} /> :
    <ToolCommand kind="Files" icon={FolderOpen} placeholder="src/file.ts, package.json, or a folder path..." button="Open" buildPrompt={(value) => `Open this project file or folder, summarize it, and if edits are needed use a worktree-isolated patch proposal instead of modifying the main worktree: ${value}`} />;

  if (kind === 'files') {
    const files = collectFiles(blocks);
    const diffs = collectDiffs(blocks);
    const rows = [...files.map((file) => ({ title: file.path, meta: file.exists ? 'exists' : 'missing' })), ...diffs.map((diff) => ({ title: diff.path, meta: 'diff' }))];
    return <div className="space-y-2">{command}{rows.length === 0 ? <Empty title="No files touched yet." /> : rows.map((file) => <Row key={`${file.meta}-${file.title}`} icon={FolderOpen} title={file.title} meta={file.meta} />)}</div>;
  }
  const filtered = blocks.filter((block) => {
    if (kind === 'terminal') return block.kind === 'tool';
    if (kind === 'browser') return block.kind === 'tool' && /browser|chrome|playwright|url|http/i.test(block.tool);
    if (kind === 'sidechat') return block.kind === 'user' || block.kind === 'assistant' || block.kind === 'reasoning';
    if (kind === 'tasks') return block.kind === 'tool' || block.kind === 'status' || block.kind === 'gate';
    return block.kind === 'evidence';
  });
  const icon = kind === 'browser' ? Globe : kind === 'sidechat' ? MessageCircle : kind === 'tasks' ? Play : kind === 'preview' ? MonitorPlay : TerminalSquare;
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
              <h2 className="truncate text-[13px] font-semibold text-bobby-ink">{active.label}</h2>
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
