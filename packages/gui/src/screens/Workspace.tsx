import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GateDecision, KernelEvent } from '@bobby/shared';
import { Check, ChevronDown, ChevronUp, GitBranch, Lightbulb, Mic, Plus, Route, Search, Send, ShieldCheck, Square } from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { useChatStore, type ChatBlock } from '../store/chat-store';
import type { CapabilityReport, CommandRecordDto, GitStatusSummary, McpServerRecordDto, SessionMode } from '../ipc/contract';

type WorkspaceProps = {
  kernelClient?: {
    startTask: (input: string, mode?: SessionMode, taskId?: string) => Promise<unknown>;
    approveGate?: (gateId: string, decision: GateDecision) => Promise<unknown>;
    restoreSnapshot?: (snapshotId?: string) => Promise<unknown>;
    getCapabilityReport?: () => Promise<CapabilityReport | null>;
    getGitStatusSummary?: () => Promise<GitStatusSummary>;
    switchGitBranch?: (input: { name: string; confirmed: true }) => Promise<{ currentBranch: string }>;
    gitCommit?: (input: { message: string }) => Promise<{ committed: boolean; hash: string | null; output: string }>;
    searchFiles?: (query: string) => Promise<Array<{ path: string; preview?: string | null }>>;
    saveAttachment?: (input: { sourcePath: string; fileName: string }) => Promise<{ path: string }>;
    listCommands?: () => Promise<CommandRecordDto[]>;
    listMcpServers?: () => Promise<McpServerRecordDto[]>;
    onEvent: (callback: (event: KernelEvent) => void) => () => void;
  };
  theme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
  onOpenPlugins?: () => void;
};

function UserBubble({ text }: { text: string }) {
  const busy = useChatStore((s) => s.busy);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(text);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!edit) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }, [edit]);

  const submit = async () => {
    if (draft.trim() && !busy) setEdit(false);
  };

  if (edit) {
    return (
      <div className="mb-5 flex flex-col items-end">
        <div
          className="w-full min-w-0 max-w-[82%] border border-accent/35 ring-1 ring-accent/15"
          style={{ background: 'var(--bobby-surface-card)', borderRadius: 18, padding: '12px 16px' }}
        >
          <textarea
            ref={ref}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              event.currentTarget.style.height = 'auto';
              event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 360)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setDraft(text);
                setEdit(false);
              } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
              }
            }}
            rows={2}
            className="block w-full min-w-0 resize-none break-words bg-transparent text-[15px] font-medium leading-[1.58] text-bobby-ink outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[12px] text-bobby-faint">Esc to cancel, Cmd+Enter to resend</span>
            <div className="flex items-center gap-2">
              <button onClick={() => { setDraft(text); setEdit(false); }} className="rounded-md px-3 py-1 text-[13px] font-medium text-bobby-muted hover:bg-bobby-hover hover:text-bobby-ink">Cancel</button>
              <button onClick={() => void submit()} disabled={!draft.trim() || busy} className="rounded-md px-3 py-1 text-[13px] font-medium text-white shadow-sm hover:brightness-110 disabled:opacity-50" style={{ background: 'var(--bobby-accent)' }}>Resend</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative mb-5 flex flex-col items-end">
      <div
        className="max-w-[82%] cursor-pointer"
        style={{ background: 'var(--bobby-bubble-user)', color: 'var(--bobby-bubble-user-fg)', borderRadius: '18px 18px 6px 18px', padding: '10px 16px' }}
        onDoubleClick={() => {
          if (!busy) {
            setDraft(text);
            setEdit(true);
          }
        }}
      >
        <span className="whitespace-pre-wrap break-words text-[15px] font-medium leading-[1.58]">{text}</span>
      </div>
      <div className="mt-1 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => { setDraft(text); setEdit(true); }}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] text-bobby-faint hover:bg-bobby-hover hover:text-bobby-ink disabled:opacity-40"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function AssistantBubble({ text, streaming }: { text: string; streaming?: boolean }) {
  if (!text.trim()) return null;
  return <div className="bobby-assistant-block mb-5"><div className="bobby-markdown px-1"><MarkdownRenderer content={text} streaming={streaming} /></div></div>;
}

function ReasoningBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-4 rounded-2xl border border-bobby-border-muted" style={{ background: 'var(--bobby-surface-subtle)' }}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-bobby-muted hover:text-bobby-ink">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4 rotate-90" />}
        Thinking
      </button>
      {open && <div className="max-h-[360px] overflow-y-auto whitespace-pre-wrap border-t border-bobby-border-muted px-4 py-3 font-mono text-[13px] leading-[1.65] text-bobby-muted">{text}</div>}
    </div>
  );
}

function ToolRow({ block }: { block: ChatBlock & { kind: 'tool' } }) {
  const done = block.status === 'done';
  const running = block.status === 'running';
  const bg = done ? 'var(--bobby-success-soft)' : 'var(--bobby-surface-subtle)';
  const border = done ? 'var(--bobby-success-soft)' : 'var(--bobby-border-muted)';
  const color = done ? 'var(--bobby-success)' : 'var(--bobby-text-muted)';
  return (
    <div className="mb-2.5 flex items-start gap-2 rounded-xl px-4 py-2.5 font-mono text-[13px]" style={{ background: bg, border: `1px solid ${border}` }}>
      <span className="mt-0.5 text-[11px] uppercase" style={{ color }}>{done ? 'done' : running ? 'run' : 'wait'}</span>
      <span className="font-medium text-bobby-ink">{block.tool}</span>
      {block.content && <span className="ml-auto max-w-[40%] truncate pl-2 text-bobby-muted">{block.content}</span>}
    </div>
  );
}

function EvidenceRow({ block }: { block: ChatBlock & { kind: 'evidence' } }) {
  const evidence = block.evidence;
  const payload = evidence.payload as Record<string, unknown>;
  const pass = evidence.evidenceType === 'command_output' ? payload.exitCode === 0 : true;
  return (
    <div
      className="mb-2.5 flex items-center gap-2 rounded-xl px-4 py-2.5 font-mono text-[13px]"
      style={{
        background: pass ? 'var(--bobby-success-soft)' : 'var(--bobby-danger-soft)',
        border: `1px solid ${pass ? 'var(--bobby-success-soft)' : 'var(--bobby-danger-soft)'}`,
        color: pass ? 'var(--bobby-success)' : 'var(--bobby-danger)'
      }}
    >
      <span className="text-[11px] uppercase">{pass ? 'pass' : 'fail'}</span>
      <span className="text-bobby-ink">{evidence.acId}/{evidence.evidenceType}</span>
      <span className="ml-auto max-w-[40%] truncate pl-2 text-bobby-muted">{String(payload.path ?? payload.stdout ?? '')}</span>
    </div>
  );
}

function expandCommandTemplate(template: string, input: string): string {
  const trimmedInput = input.trim();
  const replaced = template.replace(/\{\{\s*(input|args|text)\s*\}\}/gi, trimmedInput);
  if (replaced !== template) {
    return replaced.trim();
  }

  if (!trimmedInput) {
    return template.trim();
  }

  return `${template.trim()}\n\n${trimmedInput}`.trim();
}

const FILE_MUTATION_ACTIONS = [
  'create',
  'edit',
  'fix',
  'modify',
  'patch',
  'refactor',
  'rename',
  'remove',
  'delete',
  'update',
  'rewrite',
  'replace',
  'write'
];

const FILE_REFERENCE_PATTERN = /(?:^|[\s`"'([{])([A-Za-z0-9._/-]+\.[A-Za-z0-9]{1,12})\b/;

function shouldUseWorktreePrompt(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('worktree') || normalized.includes('proposal')) return false;
  if (!FILE_MUTATION_ACTIONS.some((action) => normalized.includes(action))) return false;
  return FILE_REFERENCE_PATTERN.test(text) || /[\\/]/.test(text);
}

function prepareTaskPrompt(text: string): string {
  const trimmed = text.trim();
  if (!shouldUseWorktreePrompt(trimmed)) {
    return trimmed;
  }

  return [
    trimmed,
    '',
    'Use an isolated git worktree for any file changes.',
    'Make edits in the worktree, then return a patch proposal instead of changing the main tree directly.',
    'Report the files touched and any validation evidence.'
  ].join('\n');
}

function StatusBanner({ block }: { block: ChatBlock & { kind: 'status' } }) {
  const palette = {
    done: { bg: 'var(--bobby-success-soft)', border: 'var(--bobby-success)', color: 'var(--bobby-success)', label: 'Completed' },
    failed: { bg: 'var(--bobby-danger-soft)', border: 'var(--bobby-danger)', color: 'var(--bobby-danger)', label: 'Failed' },
    blocked: { bg: 'var(--bobby-surface-subtle)', border: 'var(--bobby-border)', color: 'var(--bobby-text-muted)', label: 'Blocked' }
  } as const;
  const style = palette[block.status] ?? palette.done;
  return <div className="mb-5 rounded-2xl px-5 py-3 text-[14px] font-semibold" style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.color }}>{style.label}</div>;
}

function ChatRow({ block }: { block: ChatBlock }) {
  switch (block.kind) {
    case 'user': return <UserBubble text={block.text} />;
    case 'reasoning': return <ReasoningBlock text={block.text} />;
    case 'assistant': return <AssistantBubble text={block.text} />;
    case 'tool': return <ToolRow block={block} />;
    case 'evidence': return <EvidenceRow block={block} />;
    case 'verdict':
      return (
        <div className="mb-2.5 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px]" style={{ background: 'var(--bobby-danger-soft)', border: '1px solid var(--bobby-danger-soft)', color: 'var(--bobby-danger)' }}>
          <span className="text-[11px] uppercase">{block.result === 'pass' ? 'pass' : 'fail'}</span>
          <span className="font-medium text-bobby-ink">{block.acId}: {block.result}</span>
        </div>
      );
    case 'plan': return <div className="bobby-panel mb-5 p-4"><div className="text-[13px] font-semibold text-bobby-ink">Plan</div><div className="mt-1 text-[13px] text-bobby-muted">{block.steps.length} steps</div></div>;
    case 'gate': return <div className="mb-5 rounded-xl px-5 py-3 text-[14px] font-medium" style={{ background: 'var(--bobby-surface-subtle)', border: '1px solid var(--bobby-border)' }}>{block.reason}</div>;
    case 'status': return <StatusBanner block={block} />;
    case 'error': return <div className="mb-5 rounded-xl px-5 py-3 text-[14px] font-medium" style={{ background: 'var(--bobby-danger-soft)', border: '1px solid var(--bobby-danger-soft)', color: 'var(--bobby-danger)' }}>{block.message}</div>;
    default: return null;
  }
}

type ComposerMode = 'file' | 'command';

type ComposerItem = {
  key: string;
  title: string;
  detail?: string;
  mode: ComposerMode;
  onPick: () => void;
};

function collectEnvironmentSources(blocks: ChatBlock[]): string[] {
  const seen = new Set<string>();
  const push = (value: string | null | undefined) => {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
  };

  for (const block of blocks) {
    if (block.kind === 'user') {
      for (const match of block.text.matchAll(/@([A-Za-z0-9._/-]+\.[A-Za-z0-9]{1,12})/g)) {
        push(match[1]);
      }
    }
    if (block.kind === 'evidence') {
      const payload = block.evidence.payload as Record<string, unknown>;
      if (typeof payload.path === 'string') {
        push(payload.path);
      }
    }
  }

  return Array.from(seen).slice(0, 6);
}

function EnvironmentPopover({
  kernelClient,
  blocks,
  currentPlan,
  currentProject,
  previewTarget
}: {
  kernelClient?: WorkspaceProps['kernelClient'];
  blocks: ChatBlock[];
  currentPlan: Array<{ id: string; desc: string }>;
  currentProject: { name: string; path: string; lastOpenedAt: string } | null;
  previewTarget: string | null;
}) {
  const [gitSummary, setGitSummary] = useState<GitStatusSummary | null>(null);
  const [branchesOpen, setBranchesOpen] = useState(false);
  const [branchQuery, setBranchQuery] = useState('');
  const [busyBranch, setBusyBranch] = useState<string | null>(null);
  const sources = React.useMemo(() => collectEnvironmentSources(blocks), [blocks]);
  const progressSteps = currentPlan.slice(0, 4);

  useEffect(() => {
    let active = true;
    if (!currentProject || !kernelClient?.getGitStatusSummary) {
      setGitSummary(null);
      return () => {
        active = false;
      };
    }

    void kernelClient.getGitStatusSummary()
      .then((summary) => {
        if (active) {
          setGitSummary(summary);
        }
      })
      .catch(() => {
        if (active) {
          setGitSummary(null);
        }
      });

    return () => {
      active = false;
    };
  }, [currentProject, kernelClient]);

  const filteredBranches = React.useMemo(() => {
    const normalized = branchQuery.trim().toLowerCase();
    const branches = gitSummary?.branches ?? [];
    if (!normalized) {
      return branches;
    }
    return branches.filter((branch) => {
      const haystack = `${branch.name} ${branch.upstream ?? ''}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [branchQuery, gitSummary]);

  const positiveCount = gitSummary?.added ?? 0;
  const negativeCount = gitSummary?.deleted ?? 0;

  const switchBranch = async (name: string) => {
    if (!kernelClient?.switchGitBranch || busyBranch === name) {
      return;
    }
    setBusyBranch(name);
    try {
      await kernelClient.switchGitBranch({ name, confirmed: true });
      const refreshed = await kernelClient.getGitStatusSummary?.();
      if (refreshed) {
        setGitSummary(refreshed);
      }
      setBranchesOpen(false);
      setBranchQuery('');
    } finally {
      setBusyBranch(null);
    }
  };

  if (!currentProject) {
    return null;
  }

  return (
    <aside
      className="absolute right-4 top-4 z-10 w-[300px] rounded-[28px] border px-5 py-4 shadow-2xl"
      style={{ background: 'rgba(33, 33, 38, 0.96)', borderColor: 'rgba(255, 255, 255, 0.08)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold tracking-wide text-bobby-faint">环境信息</div>
        </div>
        <button
          type="button"
          aria-label="Environment settings"
          className="rounded-full p-1 text-bobby-faint transition hover:bg-bobby-hover hover:text-bobby-ink"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-4 space-y-4 text-[12px]">
        <section>
          <div className="text-bobby-faint">变更</div>
          <div className="mt-1 flex items-center gap-2 text-[16px] font-semibold">
            <span style={{ color: 'var(--bobby-success)' }}>{`+${positiveCount}`}</span>
            <span style={{ color: 'var(--bobby-danger)' }}>{`-${negativeCount}`}</span>
          </div>
        </section>

        <section className="border-t pt-3" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <div className="text-bobby-faint">本地</div>
          <div className="mt-1 flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-bobby-faint" />
            <button
              data-testid="environment-branch-toggle"
              type="button"
              onClick={() => setBranchesOpen((open) => !open)}
              className="inline-flex items-center gap-1 text-left text-[13px] font-medium text-bobby-ink"
            >
              <span className="truncate">{gitSummary?.branch ?? '非 git 项目'}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-bobby-faint transition ${branchesOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {branchesOpen ? (
            <div
              className="mt-2 rounded-2xl border p-2"
              style={{ background: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255, 255, 255, 0.08)' }}
            >
              <input
                value={branchQuery}
                onChange={(event) => setBranchQuery(event.target.value)}
                placeholder="搜索分支"
                className="w-full rounded-xl border px-3 py-2 text-[12px] text-bobby-ink outline-none placeholder:text-bobby-faint"
                style={{ background: 'rgba(255, 255, 255, 0.04)', borderColor: 'rgba(255, 255, 255, 0.08)' }}
              />
              <div className="mt-2 max-h-[160px] space-y-1 overflow-y-auto">
                {filteredBranches.map((branch) => (
                  <button
                    key={branch.name}
                    type="button"
                    disabled={busyBranch === branch.name}
                    onClick={() => void switchBranch(branch.name)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] text-bobby-muted transition hover:bg-bobby-hover hover:text-bobby-ink disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1 truncate">{branch.name}</span>
                    {branch.current ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-2 space-y-1 text-[12px] text-bobby-muted">
            <div>提交或推送</div>
            <div>创建拉取请求</div>
          </div>
        </section>

        <section className="border-t pt-3" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <div className="text-bobby-faint">进度</div>
          <div className="mt-2 space-y-2">
            {progressSteps.length === 0 ? (
              <div className="text-[12px] text-bobby-muted">暂无计划步骤</div>
            ) : (
              progressSteps.map((step, index) => (
                <div key={step.id} className="flex items-start gap-2 text-[12px] text-bobby-muted">
                  <span className="mt-[2px] inline-block h-2 w-2 rounded-full" style={{ background: index === 0 ? 'var(--bobby-success)' : 'rgba(255, 255, 255, 0.28)' }} />
                  <span className="min-w-0 flex-1 break-words">{step.desc}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="border-t pt-3" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <div className="text-bobby-faint">浏览器</div>
          <div className="mt-1 break-all text-[12px] text-bobby-ink">{previewTarget ?? '暂无浏览器'}</div>
        </section>

        <section className="border-t pt-3" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <div className="text-bobby-faint">来源</div>
          <div className="mt-2 space-y-1">
            {sources.length === 0 ? (
              <div className="text-[12px] text-bobby-muted">暂无来源</div>
            ) : (
              sources.map((source) => (
                <div key={source} className="truncate text-[12px] text-bobby-ink">
                  {source}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}

function Composer({ onSend, busy, onAbort, kernelClient, onOpenPlugins }: { onSend: (text: string) => void; busy: boolean; onAbort: () => void; kernelClient?: WorkspaceProps['kernelClient']; onOpenPlugins?: () => void }) {
  const [input, setInput] = useState('');
  const [customCommands, setCustomCommands] = useState<CommandRecordDto[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerRecordDto[]>([]);
  const [menuItems, setMenuItems] = useState<ComposerItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<ComposerMode | null>(null);
  const [menuStart, setMenuStart] = useState(0);
  const [menuEnd, setMenuEnd] = useState(0);
  const [menuIndex, setMenuIndex] = useState(0);
  const [notice, setNotice] = useState('');
  const [visionSupported, setVisionSupported] = useState<boolean | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const requestToken = useRef(0);
  const worktreeRecommended = shouldUseWorktreePrompt(input);
  const currentProject = useChatStore((s) => s.currentProject);
  const recentProjects = useChatStore((s) => s.recentProjects);
  const sessionMode = useChatStore((s) => s.sessionMode);
  const setSessionMode = useChatStore((s) => s.setSessionMode);
  const composerInsertion = useChatStore((s) => s.composerInsertion);
  const setComposerInsertion = useChatStore((s) => s.setComposerInsertion);
  const [goalTracking, setGoalTracking] = useState(true);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProjects = React.useMemo(() => {
    const normalized = projectQuery.trim().toLowerCase();
    if (!normalized) {
      return recentProjects;
    }
    return recentProjects.filter((project) => {
      const haystack = `${project.name} ${project.path}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [projectQuery, recentProjects]);

  const refreshCustomCommands = useCallback(async () => {
    const listCommands = kernelClient?.listCommands;
    if (!listCommands) return;
    try {
      setCustomCommands(await listCommands());
    } catch {
      setCustomCommands([]);
    }
  }, [kernelClient]);

  const refreshMcpServers = useCallback(async () => {
    const listMcpServers = kernelClient?.listMcpServers;
    if (!listMcpServers) return;
    try {
      setMcpServers(await listMcpServers());
    } catch {
      setMcpServers([]);
    }
  }, [kernelClient]);

  const insertTextAtCursor = useCallback((value: string) => {
    const start = ref.current?.selectionStart ?? input.length;
    const end = ref.current?.selectionEnd ?? start;
    const nextValue = `${input.slice(0, start)}${value}${input.slice(end)}`;
    setInput(nextValue);
    pendingSelection.current = { start: start + value.length, end: start + value.length };
  }, [input]);

  useEffect(() => {
    let active = true;
    const listCommands = kernelClient?.listCommands;
    if (!listCommands) return;

    void (async () => {
      try {
        const commands = await listCommands();
        if (active) setCustomCommands(commands);
      } catch {
        if (active) setCustomCommands([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [kernelClient, refreshCustomCommands]);

  useEffect(() => {
    let active = true;
    const getCapabilityReport = kernelClient?.getCapabilityReport;
    if (!getCapabilityReport) return;

    void (async () => {
      try {
        const report = await getCapabilityReport();
        if (active) {
          setVisionSupported(report?.useVision ?? false);
        }
      } catch {
        if (active) {
          setVisionSupported(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [kernelClient]);

  useEffect(() => {
    let active = true;
    const listMcpServers = kernelClient?.listMcpServers;
    if (!listMcpServers) {
      setMcpServers([]);
      return;
    }

    void (async () => {
      try {
        const servers = await listMcpServers();
        if (active) {
          setMcpServers(servers);
        }
      } catch {
        if (active) {
          setMcpServers([]);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [kernelClient, refreshMcpServers]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleCommandChange = () => {
      void refreshCustomCommands();
    };

    window.addEventListener('bobby:commands-changed', handleCommandChange as EventListener);
    return () => {
      window.removeEventListener('bobby:commands-changed', handleCommandChange as EventListener);
    };
  }, [refreshCustomCommands]);

  const confirmAndRestoreLatest = useCallback(() => {
    if (!kernelClient?.restoreSnapshot) return;
    if (typeof window !== 'undefined' && !window.confirm('Restore the latest checkpoint?')) return;
    void kernelClient.restoreSnapshot(undefined);
  }, [kernelClient]);

  const commands = React.useMemo(() => [
    {
      key: 'plan',
      title: 'plan',
      detail: 'Draft a step-by-step plan',
      run: () => onSend(prepareTaskPrompt('Create a detailed plan for this project with concrete steps and validation points.'))
    },
    {
      key: 'undo',
      title: 'undo',
      detail: 'Restore the latest snapshot',
      run: confirmAndRestoreLatest
    },
    {
      key: 'status',
      title: 'status',
      detail: 'Summarize blockers and progress',
      run: () => onSend(prepareTaskPrompt('Summarize the current task status, blockers, and next step.'))
    },
    {
      key: 'cost',
      title: 'cost',
      detail: 'Report current usage',
      run: () => onSend(prepareTaskPrompt('Report the current task cost, token usage, and any notable spend.'))
    },
    ...customCommands.map((command) => ({
      key: command.sourcePath,
      title: command.name,
      detail: command.description,
      run: () => onSend(expandCommandTemplate(command.promptTemplate, ''))
    }))
  ], [confirmAndRestoreLatest, customCommands, onSend]);

  const applySelection = useCallback((nextValue: string, cursor: number) => {
    setInput(nextValue);
    pendingSelection.current = { start: cursor, end: cursor };
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuMode(null);
    setMenuItems([]);
    setMenuIndex(0);
  }, []);

  const replaceToken = useCallback((replacement: string) => {
    const selection = pendingSelection.current ?? { start: menuEnd, end: menuEnd };
    const nextValue = `${input.slice(0, menuStart)}${replacement}${input.slice(selection.end)}`;
    applySelection(nextValue, menuStart + replacement.length);
    closeMenu();
  }, [applySelection, closeMenu, input, menuEnd, menuStart]);

  const pickItem = useCallback((item: ComposerItem) => {
    item.onPick();
    closeMenu();
  }, [closeMenu]);

  const executeCurrent = useCallback(() => {
    const item = menuItems[menuIndex];
    if (!item) return;
    pickItem(item);
  }, [menuIndex, menuItems, pickItem]);

  const openSuggestions = useCallback((value: string, cursor: number) => {
    const before = value.slice(0, cursor);
    const lineStart = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r'));
    const tokenStart = Math.max(before.lastIndexOf(' '), before.lastIndexOf('\t'), lineStart) + 1;
    const token = before.slice(tokenStart);
    pendingSelection.current = { start: tokenStart, end: cursor };

    if (token.startsWith('@')) {
      const query = token.slice(1).trim();
      setMenuMode('file');
      setMenuStart(tokenStart);
      setMenuEnd(cursor);
      setMenuOpen(true);
      setMenuIndex(0);
      const tokenId = ++requestToken.current;
      void (async () => {
        const results = await kernelClient?.searchFiles?.(query) ?? [];
        if (requestToken.current !== tokenId) return;
        setMenuItems(results.map((result) => ({
          key: result.path,
          title: result.path.split(/[\\/]/).pop() ?? result.path,
          detail: [result.path, result.preview?.trim()].filter(Boolean).join(' · '),
          mode: 'file',
          onPick: () => replaceToken(`@${result.path}`)
        })));
      })();
      return;
    }

    if (token.startsWith('/')) {
      const query = token.slice(1).trim().toLowerCase();
      const filtered = commands.filter((command) =>
        !query || command.title.includes(query) || command.detail.toLowerCase().includes(query)
      );
      setMenuMode('command');
      setMenuStart(tokenStart);
      setMenuEnd(cursor);
      setMenuOpen(true);
      setMenuIndex(0);
      setMenuItems(filtered.map((command) => ({
        key: command.key,
        title: command.title,
        detail: command.detail,
        mode: 'command',
        onPick: command.run
      })));
      return;
    }

    closeMenu();
  }, [closeMenu, commands, kernelClient?.searchFiles, replaceToken]);

  useEffect(() => {
    if (!menuOpen) return;
    if (!input.trim().startsWith('/')) return;
    openSuggestions(input, input.length);
  }, [customCommands, input, menuOpen, openSuggestions]);

  const processCommand = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('/')) {
      const command = trimmed.split(/\s+/, 1)[0].slice(1).toLowerCase();
      const customCommand = customCommands.find((item) => item.name.toLowerCase() === command);
      if (customCommand) {
        const args = trimmed.slice(command.length + 2).trim();
        onSend(prepareTaskPrompt(expandCommandTemplate(customCommand.promptTemplate, args)));
        setInput('');
        setHistory((current) => [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, 20));
        setHistoryIndex(-1);
        closeMenu();
        ref.current?.focus();
        return;
      }
      const store = useChatStore.getState();
      switch (command) {
        case 'clear':
          store.clearBlocks();
          break;
        case 'help':
          onSend(prepareTaskPrompt('help'));
          break;
        case 'plan':
          onSend(prepareTaskPrompt('Create a detailed plan for this project with concrete steps and validation points.'));
          break;
        case 'review':
          onSend(prepareTaskPrompt('Review the code changes and identify bugs.'));
          break;
        case 'status':
          onSend(prepareTaskPrompt('Summarize the current task status, blockers, and next step.'));
          break;
        case 'cost':
          onSend(prepareTaskPrompt('Report the current task cost, token usage, and any notable spend.'));
          break;
        case 'undo':
          confirmAndRestoreLatest();
          break;
        default:
          onSend(prepareTaskPrompt(trimmed));
          break;
      }
    } else {
      onSend(prepareTaskPrompt(trimmed));
    }

    setInput('');
    setHistory((current) => [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, 20));
    setHistoryIndex(-1);
    closeMenu();
    ref.current?.focus();
  }, [closeMenu, confirmAndRestoreLatest, customCommands, onSend]);

  const send = useCallback(() => processCommand(input), [input, processCommand]);

  const key = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setMenuIndex((current) => (menuItems.length === 0 ? 0 : (current + 1) % menuItems.length));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setMenuIndex((current) => (menuItems.length === 0 ? 0 : (current - 1 + menuItems.length) % menuItems.length));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        executeCurrent();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }
    }

    if (event.key === 'ArrowUp' && history.length > 0 && historyIndex < history.length - 1) {
      event.preventDefault();
      const nextIndex = historyIndex + 1;
      const nextValue = history[nextIndex];
      if (nextValue !== undefined) {
        setHistoryIndex(nextIndex);
        setInput(nextValue);
      }
      return;
    }
    if (event.key === 'ArrowDown' && historyIndex >= 0) {
      event.preventDefault();
      const nextIndex = historyIndex - 1;
      if (nextIndex < 0) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        const nextValue = history[nextIndex];
        if (nextValue !== undefined) {
          setHistoryIndex(nextIndex);
          setInput(nextValue);
        }
      }
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      processCommand(input);
    }
  }, [closeMenu, executeCurrent, history, historyIndex, input, menuItems.length, menuOpen, processCommand]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    if (!composerInsertion) {
      return;
    }
    insertTextAtCursor(`${composerInsertion} `);
    setNotice(`Inserted workspace file reference: ${composerInsertion}`);
    setComposerInsertion(null);
    ref.current?.focus();
  }, [composerInsertion, insertTextAtCursor, setComposerInsertion]);

  useEffect(() => {
    const selection = pendingSelection.current;
    if (!selection) return;
    const el = ref.current;
    if (!el) return;
    try {
      el.setSelectionRange(selection.start, selection.end);
    } catch {}
    pendingSelection.current = null;
  }, [input]);

  useEffect(() => {
    if (!menuOpen || menuMode !== 'command') return;
    setMenuIndex((current) => Math.min(current, Math.max(menuItems.length - 1, 0)));
  }, [menuItems.length, menuMode, menuOpen]);

  const onChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setInput(nextValue);
    openSuggestions(nextValue, event.target.selectionStart ?? nextValue.length);
  }, [openSuggestions]);

  const onClick = useCallback((event: React.MouseEvent<HTMLTextAreaElement>) => {
    openSuggestions(input, event.currentTarget.selectionStart ?? input.length);
  }, [input, openSuggestions]);

  const insertImageReference = useCallback(async (image: File & { path?: string }, sourcePath: string) => {
    let referencePath = sourcePath;
    let saved = false;
    let saveError = '';
    try {
      const result = await kernelClient?.saveAttachment?.({ sourcePath, fileName: image.name });
      if (result?.path) {
        referencePath = result.path;
        saved = true;
      }
    } catch (error) {
      saveError = error instanceof Error ? error.message : String(error);
    }

    if (saved) {
      setNotice(
        visionSupported
          ? 'Vision is enabled; Bobby saved the image to the workspace and will send it as multimodal input.'
          : 'Vision is not enabled; Bobby saved the image to the workspace and inserted a path reference instead.'
      );
    } else if (saveError) {
      setNotice(`Image save failed, so Bobby inserted the original path reference: ${saveError}`);
    } else {
      setNotice(
        visionSupported
          ? 'Vision is enabled; Bobby will send workspace image references as multimodal input.'
          : 'Vision is not enabled in this build, so Bobby inserted a local file path reference instead.'
      );
    }

    insertTextAtCursor(`![${image.name}](${referencePath})`);
  }, [insertTextAtCursor, kernelClient, visionSupported]);

  const handlePickedFiles = useCallback(async (fileList: FileList | null) => {
    const selected = Array.from(fileList ?? []);
    const file = selected[0] ?? null;
    if (!file) return;

    const sourcePath = (file as File & { path?: string }).path;
    if (!sourcePath) {
      setNotice('Selected file requires a local path. Try adding it from the workspace.');
      return;
    }

    if (file.type.startsWith('image/')) {
      await insertImageReference(file, sourcePath);
      return;
    }

    insertTextAtCursor(`@${sourcePath}`);
    setNotice(`Inserted local file reference: ${sourcePath}`);
  }, [insertImageReference, insertTextAtCursor]);

  const onPaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files ?? []);
    const image = files.find((file) => file.type.startsWith('image/')) ?? null;
    if (!image) return;

    const path = (image as File & { path?: string }).path;
    if (!path) {
      setNotice('Clipboard image requires a local file path; save it to the workspace first.');
      return;
    }

    event.preventDefault();
    void insertImageReference(image, path);
  }, [insertImageReference]);

  const onDrop = useCallback((event: React.DragEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.dataTransfer.files ?? []);
    const image = files.find((file) => file.type.startsWith('image/')) ?? null;
    if (!image) return;

    const path = (image as File & { path?: string }).path;
    if (!path) {
      setNotice('Dropped image needs a local file path; save it to the workspace first.');
      return;
    }

    event.preventDefault();
    void insertImageReference(image, path);
  }, [insertImageReference]);

  const permissionLabel = '\u5b8c\u5168\u8bbf\u95ee';
  const projectLabel = currentProject?.name ?? '\u4e0d\u4f7f\u7528\u9879\u76ee';
  const modeLabel = sessionMode === 'plan-only' ? '\u8ba1\u5212\u6a21\u5f0f' : '\u6807\u51c6\u6a21\u5f0f';

  const createActions = [
    {
      key: 'mission',
      label: '\u521b\u5efa\u4efb\u52a1',
      prompt: 'Help me turn this rough request into a concrete task with scope, assumptions, risks, and acceptance criteria.'
    },
    {
      key: 'plan',
      label: '\u521b\u5efa\u8ba1\u5212',
      prompt: 'Create a step-by-step execution plan with evidence checkpoints, testing, and final acceptance criteria.'
    }
  ] as const;

  const pluginEntries = React.useMemo(() => {
    return mcpServers.map((server) => ({
      id: server.id,
      name: server.name,
      detail: server.health === 'healthy' ? 'Healthy' : server.health === 'disabled' ? 'Disabled' : server.health === 'error' ? 'Error' : 'Unknown'
    }));
  }, [mcpServers]);

  const togglePlanMode = useCallback(() => {
    setSessionMode(sessionMode === 'plan-only' ? 'standard' : 'plan-only');
  }, [sessionMode, setSessionMode]);

  const selectProjectEntry = useCallback((path: string | null) => {
    if (!path) {
      useChatStore.setState({ currentProject: null });
      setProjectPickerOpen(false);
      return;
    }
    const project = recentProjects.find((entry) => entry.path === path) ?? null;
    if (project) {
      useChatStore.setState({ currentProject: project });
    }
    setProjectPickerOpen(false);
  }, [recentProjects]);

  return (
    <div className="px-4 pb-4 pt-2" style={{ background: 'var(--bobby-bg-canvas)' }}>
      <div
        data-testid="composer-console"
        className="mx-auto max-w-[760px] rounded-[28px] border"
        style={{
          background: 'rgba(27, 27, 31, 0.94)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)'
        }}
      >
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-[12px]">
          <div className="relative">
            <button
              type="button"
              aria-expanded={plusMenuOpen}
              onClick={() => setPlusMenuOpen((current) => !current)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-bobby-muted transition hover:text-bobby-ink"
              style={{ borderColor: 'rgba(255, 255, 255, 0.1)', background: 'rgba(255, 255, 255, 0.04)' }}
              title="Add photos and files"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            {plusMenuOpen ? (
              <div
                className="absolute left-0 top-full z-20 mt-2 w-[280px] rounded-2xl border p-3 shadow-2xl"
                style={{ background: 'rgba(28, 28, 33, 0.98)', borderColor: 'rgba(255, 255, 255, 0.08)' }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-[13px] text-bobby-muted transition hover:bg-bobby-hover hover:text-bobby-ink"
                >
                  {'\u6dfb\u52a0\u7167\u7247\u548c\u6587\u4ef6'}
                </button>

                <div className="mt-2 rounded-xl border px-3 py-2" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                  <div className="text-[12px] font-medium text-bobby-ink">{'\u521b\u5efa'}</div>
                  <div className="mt-2 space-y-1">
                    {createActions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        onClick={() => {
                          setPlusMenuOpen(false);
                          setInput(action.prompt);
                        }}
                        className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-bobby-muted transition hover:bg-bobby-hover hover:text-bobby-ink"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-2 rounded-xl border px-3 py-2" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                  <div className="text-[12px] font-medium text-bobby-ink">{'\u8ba1\u5212\u6a21\u5f0f'}</div>
                  <button
                    type="button"
                    onClick={() => setSessionMode(sessionMode === 'plan-only' ? 'standard' : 'plan-only')}
                    className="mt-2 block w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-bobby-muted transition hover:bg-bobby-hover hover:text-bobby-ink"
                  >
                    {sessionMode === 'plan-only' ? '\u5173\u95ed\u8ba1\u5212\u6a21\u5f0f' : '\u5f00\u542f\u8ba1\u5212\u6a21\u5f0f'}
                  </button>
                </div>

                <div className="mt-2 rounded-xl border px-3 py-2" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                  <div className="text-[12px] font-medium text-bobby-ink">{'\u76ee\u6807'}</div>
                  <button
                    type="button"
                    onClick={() => setGoalTracking((current) => !current)}
                    className="mt-2 block w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-bobby-muted transition hover:bg-bobby-hover hover:text-bobby-ink"
                  >
                    {goalTracking ? '\u5173\u95ed\u76ee\u6807\u8ffd\u8e2a' : '\u5f00\u542f\u76ee\u6807\u8ffd\u8e2a'}
                  </button>
                </div>

                <div className="mt-2 rounded-xl border px-3 py-2" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                  <div className="text-[12px] font-medium text-bobby-ink">{'\u63d2\u4ef6'}</div>
                  <div className="mt-2 text-[11px] text-bobby-faint">{`${pluginEntries.length} \u4e2a\u5df2\u5b89\u88c5\u63d2\u4ef6`}</div>
                  <div className="mt-2 space-y-1">
                    {pluginEntries.length === 0 ? (
                      <div className="rounded-lg px-2 py-1.5 text-[12px] text-bobby-faint">
                        {'\u6682\u65e0\u5df2\u8fde\u63a5\u63d2\u4ef6'}
                      </div>
                    ) : (
                      pluginEntries.map((plugin) => (
                        <div key={plugin.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[12px] text-bobby-muted">
                          <span className="truncate">{plugin.name}</span>
                          <span className="shrink-0 text-[11px] text-bobby-faint">{plugin.detail}</span>
                        </div>
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        onOpenPlugins?.();
                      }}
                      className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-bobby-muted transition hover:bg-bobby-hover hover:text-bobby-ink"
                    >
                      {'\u7ba1\u7406\u63d2\u4ef6'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-full px-2.5 py-1 font-medium"
            style={{ color: '#fb923c', background: 'rgba(251, 146, 60, 0.12)' }}
          >
            {permissionLabel}
          </button>
          <button
            data-testid="composer-plan-toggle"
            type="button"
            aria-pressed={sessionMode === 'plan-only'}
            onClick={togglePlanMode}
            className="rounded-full px-2.5 py-1 text-bobby-muted transition hover:text-bobby-ink"
            style={{ background: sessionMode === 'plan-only' ? 'rgba(255, 255, 255, 0.1)' : 'transparent' }}
          >
            计划模式
          </button>
          <button
            data-testid="composer-goal-toggle"
            type="button"
            aria-pressed={goalTracking}
            onClick={() => setGoalTracking((current) => !current)}
            className="rounded-full px-2.5 py-1 text-bobby-muted transition hover:text-bobby-ink"
            style={{ background: goalTracking ? 'rgba(255, 255, 255, 0.1)' : 'transparent' }}
          >
            {'\u76ee\u6807'}
          </button>
          <span className="ml-auto text-[11px] text-bobby-faint">{modeLabel}</span>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              void handlePickedFiles(event.currentTarget.files);
              event.currentTarget.value = '';
            }}
          />
        </div>

        <div className="px-4 pb-2 pt-2">
          <div
            className="relative rounded-[22px] border"
            style={{ background: 'rgba(255, 255, 255, 0.04)', borderColor: 'rgba(255, 255, 255, 0.08)' }}
          >
            <textarea
              ref={ref}
              value={input}
              onChange={onChange}
              onKeyDown={key}
              onClick={onClick}
              onPaste={onPaste}
              onDrop={onDrop}
              placeholder="随心输入，或试试 /help /plan /review... / Describe a task..."
              rows={1}
              className="min-h-[88px] w-full resize-none border-0 bg-transparent px-5 py-4 text-[16px] leading-[1.55] text-white outline-none placeholder:text-bobby-faint"
            />
            {menuOpen && menuItems.length > 0 && (
              <div className="absolute left-3 right-3 top-full z-20 mt-2 rounded-2xl border p-2 shadow-xl" style={{ background: 'var(--bobby-surface-elevated)', borderColor: 'var(--bobby-border)' }}>
                {menuItems.map((item, index) => (
                  <button
                    key={item.key}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      pickItem(item);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] transition ${index === menuIndex ? 'bg-bobby-hover text-bobby-ink' : 'text-bobby-muted hover:bg-bobby-hover hover:text-bobby-ink'}`}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                    {item.detail && <span className="truncate text-[11px] text-bobby-faint">{item.detail}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t px-4 pb-3 pt-2" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
          <div className="relative">
            <button
              data-testid="composer-project-picker"
              type="button"
              onClick={() => setProjectPickerOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] text-bobby-muted transition hover:text-bobby-ink"
              style={{ background: 'rgba(255, 255, 255, 0.06)' }}
            >
              {projectLabel}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {projectPickerOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-[320px] rounded-2xl border p-3 shadow-2xl" style={{ background: 'rgba(28, 28, 33, 0.98)', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                <input
                  value={projectQuery}
                  onChange={(event) => setProjectQuery(event.target.value)}
                  placeholder="搜索项目"
                  className="w-full rounded-xl border px-3 py-2 text-[12px] text-white outline-none placeholder:text-bobby-faint"
                  style={{ background: 'rgba(255, 255, 255, 0.04)', borderColor: 'rgba(255, 255, 255, 0.08)' }}
                />
                <div className="mt-3 max-h-[240px] space-y-1 overflow-y-auto">
                  {filteredProjects.map((project) => (
                    <button
                      key={project.path}
                      type="button"
                      onClick={() => selectProjectEntry(project.path)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] text-bobby-muted transition hover:bg-bobby-hover hover:text-bobby-ink"
                    >
                      <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  {currentProject?.path === project.path ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                  ))}
                </div>
                <div className="mt-3 space-y-1 border-t pt-3" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setProjectPickerOpen(false);
                      void window.bobby?.openProject?.();
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-[13px] text-bobby-muted transition hover:bg-bobby-hover hover:text-bobby-ink"
                  >
                    {'\u6dfb\u52a0\u65b0\u9879\u76ee'}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectProjectEntry(null)}
                    className="block w-full rounded-xl px-3 py-2 text-left text-[13px] text-bobby-muted transition hover:bg-bobby-hover hover:text-bobby-ink"
                  >
                    {'\u4e0d\u4f7f\u7528\u9879\u76ee'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <span className="rounded-full px-3 py-1.5 text-[12px] text-bobby-muted" style={{ background: 'rgba(255, 255, 255, 0.06)' }}>{'\u672c\u5730\u6a21\u5f0f'}</span>
          <span className="rounded-full px-3 py-1.5 text-[12px] text-bobby-muted" style={{ background: 'rgba(255, 255, 255, 0.06)' }}>
            {currentProject?.path?.split(/[\\/]/).filter(Boolean).at(-1) ?? '\u65e0\u5206\u652f'}
          </span>
          <span className="ml-auto inline-flex items-center gap-2 text-[12px] text-bobby-faint">
            <Mic className="h-3.5 w-3.5" />
          </span>
          {busy ? (
            <button onClick={onAbort} aria-label="Stop current task" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white hover:opacity-90" style={{ background: 'var(--bobby-danger)' }}>
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : null}
          <button onClick={send} disabled={!input.trim()} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-40" style={{ background: 'var(--bobby-accent)' }}>
            <Send className="h-3.5 w-3.5" />Send
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-[760px] justify-between px-2 pb-2 pt-2">
        <span className="text-[11px] text-bobby-faint">Ctrl+N new / Ctrl+K clear / /help /plan /review /status /cost /undo</span>
        <span className="text-[11px] text-bobby-faint">Enter to send, Shift+Enter for new line</span>
      </div>
      {worktreeRecommended && (
        <div className="mx-auto max-w-[760px] px-2 pb-2">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] text-bobby-muted" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--bobby-accent)' }} />
            Worktree proposal enabled
          </div>
        </div>
      )}
      {notice && <div className="mx-auto max-w-[760px] px-2 pb-2 text-[11px] text-bobby-muted">{notice}</div>}
    </div>
  );
}

function SuggestionCards({ onPick }: { onPick: (text: string) => void }) {
  const cards = [
    { icon: Lightbulb, title: 'Shape a mission', sub: 'Turn a rough goal into acceptance criteria', prompt: 'Help me brainstorm this goal into a clear mission, assumptions, risks, and acceptance criteria before implementation.' },
    { icon: GitBranch, title: 'Explore approaches', sub: 'Compare paths before choosing one', prompt: 'Brainstorm multiple implementation approaches for the current goal, compare tradeoffs, and recommend the safest plan.' },
    { icon: Route, title: 'Build the plan', sub: 'Create steps, tools, evidence, and gates', prompt: 'Create a step-by-step execution plan with tool calls, evidence to collect, permission pause points, and final validation.' },
    { icon: ShieldCheck, title: 'Run with proof', sub: 'Execute only with visible evidence gates', prompt: 'Run this through Mission Control. Show the current task, plan steps, tool calls, evidence, permission pauses, and final acceptance state.' },
    { icon: Search, title: 'Audit the session', sub: 'Find gaps against the requested outcome', prompt: 'Review the current session against the original request, identify missing requirements, and propose concrete fixes.' }
  ];
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="max-w-[760px]">
        <div className="text-5xl font-semibold tracking-tight text-bobby-ink">{'\u6211\u4eec\u5e94\u8be5\u5728 Bobby \u4e2d\u6784\u5efa\u4ec0\u4e48?'}</div>
        <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-7 text-bobby-muted">{'\u4ece\u4e00\u4e2a\u660e\u786e\u4efb\u52a1\u5f00\u59cb\uff0c\u7136\u540e\u8ba9\u4ee3\u7406\u89c4\u5212\u3001\u6267\u884c\u3001\u4e3e\u8bc1\u5e76\u5b8c\u6210\u9a8c\u6536\u3002'}</p>
      </div>
      <div className="mt-12 grid w-full max-w-[720px] grid-cols-2 gap-3 text-left">
        {cards.map((card) => (
          <button
            key={card.title}
            onClick={() => onPick(card.prompt)}
            className="bobby-empty-hero-card cursor-pointer rounded-2xl border p-4 transition-all hover:border-accent/30 hover:shadow-md"
            style={{ background: 'rgba(255, 255, 255, 0.04)', borderColor: 'rgba(255, 255, 255, 0.08)' }}
          >
            <card.icon className="mb-2 h-5 w-5" style={{ color: 'var(--bobby-accent)' }} />
            <div className="text-[13px] font-semibold text-bobby-ink">{card.title}</div>
            <div className="mt-0.5 text-[12px] text-bobby-muted">{card.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Workspace({ kernelClient, theme = 'light', onThemeChange, onOpenPlugins }: WorkspaceProps) {
  const blocks = useChatStore((s) => s.blocks);
  const liveReasoning = useChatStore((s) => s.liveReasoning);
  const liveAssistant = useChatStore((s) => s.liveAssistant);
  const busy = useChatStore((s) => s.busy);
  const status = useChatStore((s) => s.status);
  const costUsd = useChatStore((s) => s.costUsd);
  const model = useChatStore((s) => s.model);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const setClient = useChatStore((s) => s.setClient);
  const handleEvent = useChatStore((s) => s.handleEvent);
  const abort = useChatStore((s) => s.abort);
  const clearBlocks = useChatStore((s) => s.clearBlocks);
  const newSession = useChatStore((s) => s.newSession);
  const currentTaskId = useChatStore((s) => s.currentTaskId);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const threads = useChatStore((s) => s.threads);
  const currentPlan = useChatStore((s) => s.currentPlan);
  const currentProject = useChatStore((s) => s.currentProject);
  const previewTarget = useChatStore((s) => s.previewTarget);
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeThread = activeSessionId ? threads[activeSessionId] ?? null : null;
  const headerTitle = activeThread?.title ?? '\u65b0\u5bf9\u8bdd';
  const showTaskHeader = blocks.length > 0 || busy || Boolean(liveAssistant) || Boolean(liveReasoning);

  useEffect(() => {
    if (blocks.length === 0 && !busy && !liveAssistant && !liveReasoning) {
      return;
    }
    try {
      bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    } catch {}
  }, [blocks, busy, liveAssistant, liveReasoning]);

  useEffect(() => {
    if (!kernelClient) return;
    setClient(kernelClient);
    return () => setClient(null);
  }, [kernelClient, setClient]);

  useEffect(() => {
    if (!kernelClient) return undefined;
    return kernelClient.onEvent(handleEvent);
  }, [kernelClient, handleEvent]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === 'k') {
        event.preventDefault();
        clearBlocks();
      }
      if (mod && event.key === 'n') {
        event.preventDefault();
        newSession();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clearBlocks, newSession]);

  return (
    <div className="relative flex h-full flex-col" style={{ background: 'var(--bobby-stage-gradient)' }}>
      <EnvironmentPopover
        kernelClient={kernelClient}
        blocks={blocks}
        currentPlan={currentPlan}
        currentProject={currentProject}
        previewTarget={previewTarget}
      />
      <div style={{ background: 'var(--bobby-topbar-bg)', boxShadow: 'var(--bobby-topbar-shadow)', borderBottom: '1px solid var(--bobby-border-muted)' }}>
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <h2 className="select-none text-[13px] font-bold tracking-tight text-bobby-ink">Bobby</h2>
            {busy && <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--bobby-accent-soft)', color: 'var(--bobby-accent)' }}><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--bobby-accent)' }} />Working</span>}
            {!busy && status !== 'idle' && <span className="text-[12px] capitalize text-bobby-muted">{status}</span>}
          </div>
          <div className="flex items-center gap-3 text-[12px] text-bobby-muted">
            {model && <span>{model}</span>}
            {costUsd > 0 && <span>${costUsd.toFixed(4)}</span>}
            <button onClick={() => onThemeChange?.(theme === 'light' ? 'dark' : 'light')} className="rounded-md px-2 py-1 hover:text-bobby-ink">
              {theme === 'light' ? 'Dark' : 'Light'}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-bobby-muted transition hover:bg-bobby-hover hover:text-bobby-ink"
              >
                {selectedModel === 'deepseek-chat' ? 'V3' : 'R1'}
                {showModelPicker ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showModelPicker && (
                <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border py-1 shadow-lg" style={{ background: 'var(--bobby-surface-elevated)', borderColor: 'var(--bobby-border)' }}>
                  <button onClick={() => { setSelectedModel('deepseek-chat'); setShowModelPicker(false); }} className={`w-full px-3 py-2 text-left text-[13px] transition hover:bg-bobby-hover ${selectedModel === 'deepseek-chat' ? 'font-medium text-bobby-ink' : 'text-bobby-muted'}`}>DeepSeek Chat (V3)</button>
                  <button onClick={() => { setSelectedModel('deepseek-reasoner'); setShowModelPicker(false); }} className={`w-full px-3 py-2 text-left text-[13px] transition hover:bg-bobby-hover ${selectedModel === 'deepseek-reasoner' ? 'font-medium text-bobby-ink' : 'text-bobby-muted'}`}>DeepSeek Reasoner (R1)</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-4 border-t" style={{ borderColor: 'var(--bobby-border-muted)' }} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[860px] px-4 py-5">
          {showTaskHeader ? (
            <div className="mb-4 rounded-[24px] border px-5 py-4" style={{ background: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-[28px] font-semibold tracking-tight text-bobby-ink">{headerTitle}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-bobby-faint">
                    <span>{busy ? '\u6b63\u5728\u601d\u8003' : status === 'idle' ? '\u7b49\u5f85\u8f93\u5165' : status}</span>
                    {currentTaskId ? <span>{`• ${currentTaskId}`}</span> : null}
                  </div>
                </div>
                <div className="rounded-full px-3 py-1 text-[11px] font-medium text-bobby-muted" style={{ background: 'rgba(255, 255, 255, 0.06)' }}>
                  {selectedModel === 'deepseek-chat' ? 'V3' : 'R1'}
                </div>
              </div>
            </div>
          ) : null}
          {blocks.length === 0 && !busy && <SuggestionCards onPick={sendMessage} />}
          {blocks.map((block) => <ChatRow key={block.id} block={block} />)}
          {busy && (
            <>
              {liveReasoning && <ReasoningBlock text={liveReasoning} />}
              {liveAssistant && <AssistantBubble text={liveAssistant} streaming />}
            </>
          )}
          <style>{'@keyframes bobby-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}'}</style>
          <div ref={bottomRef} />
        </div>
      </div>
      <Composer kernelClient={kernelClient} onSend={sendMessage} busy={busy} onAbort={abort} onOpenPlugins={onOpenPlugins} />
    </div>
  );
}
