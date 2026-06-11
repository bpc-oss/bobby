import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { KernelEvent } from '@bobby/shared';
import { ChevronDown, ChevronUp, GitBranch, Lightbulb, Route, Search, Send, ShieldCheck, Square } from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { useChatStore, type ChatBlock } from '../store/chat-store';
import type { SessionMode } from '../ipc/contract';

type WorkspaceProps = {
  kernelClient?: {
    startTask: (input: string, mode?: SessionMode) => Promise<unknown>;
    approveGate?: (gateId: string, decision: string) => Promise<unknown>;
    restoreSnapshot?: (snapshotId?: string) => Promise<unknown>;
    searchFiles?: (query: string) => Promise<Array<{ path: string; preview?: string | null }>>;
    onEvent: (callback: (event: KernelEvent) => void) => () => void;
  };
  theme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
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

function Composer({ onSend, busy, onAbort, kernelClient }: { onSend: (text: string) => void; busy: boolean; onAbort: () => void; kernelClient?: WorkspaceProps['kernelClient'] }) {
  const [input, setInput] = useState('');
  const [menuItems, setMenuItems] = useState<ComposerItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<ComposerMode | null>(null);
  const [menuStart, setMenuStart] = useState(0);
  const [menuEnd, setMenuEnd] = useState(0);
  const [menuIndex, setMenuIndex] = useState(0);
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const requestToken = useRef(0);

  const commands = [
    {
      key: 'plan',
      title: 'plan',
      detail: 'Draft a step-by-step plan',
      run: () => onSend('Create a detailed plan for this project with concrete steps and validation points.')
    },
    {
      key: 'undo',
      title: 'undo',
      detail: 'Restore the latest snapshot',
      run: () => void kernelClient?.restoreSnapshot?.(undefined)
    },
    {
      key: 'status',
      title: 'status',
      detail: 'Summarize blockers and progress',
      run: () => onSend('Summarize the current task status, blockers, and next step.')
    },
    {
      key: 'cost',
      title: 'cost',
      detail: 'Report current usage',
      run: () => onSend('Report the current task cost, token usage, and any notable spend.')
    }
  ] as const;

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
          detail: result.path,
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

  const processCommand = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('/')) {
      const command = trimmed.split(/\s+/, 1)[0].slice(1).toLowerCase();
      const store = useChatStore.getState();
      switch (command) {
        case 'clear':
          store.clearBlocks();
          break;
        case 'help':
          onSend('help');
          break;
        case 'plan':
          onSend('Create a detailed plan for this project with concrete steps and validation points.');
          break;
        case 'review':
          onSend('Review the code changes and identify bugs.');
          break;
        case 'status':
          onSend('Summarize the current task status, blockers, and next step.');
          break;
        case 'cost':
          onSend('Report the current task cost, token usage, and any notable spend.');
          break;
        case 'undo':
          void kernelClient?.restoreSnapshot?.(undefined);
          break;
        default:
          onSend(trimmed);
          break;
      }
    } else {
      onSend(trimmed);
    }

    setInput('');
    setHistory((current) => [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, 20));
    setHistoryIndex(-1);
    closeMenu();
    ref.current?.focus();
  }, [closeMenu, kernelClient?.restoreSnapshot, onSend]);

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
    setNotice('Vision is not enabled in this build, so Bobby inserted a local file path reference instead.');
    const insertion = `![${image.name}](${path})`;
    const cursor = ref.current?.selectionStart ?? input.length;
    const nextValue = `${input.slice(0, cursor)}${insertion}${input.slice(ref.current?.selectionEnd ?? cursor)}`;
    setInput(nextValue);
    pendingSelection.current = { start: cursor + insertion.length, end: cursor + insertion.length };
  }, [input]);

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
    setNotice('Vision is not enabled in this build, so Bobby inserted a local file path reference instead.');
    const insertion = `![${image.name}](${path})`;
    const cursor = ref.current?.selectionStart ?? input.length;
    const nextValue = `${input.slice(0, cursor)}${insertion}${input.slice(ref.current?.selectionEnd ?? cursor)}`;
    setInput(nextValue);
    pendingSelection.current = { start: cursor + insertion.length, end: cursor + insertion.length };
  }, [input]);

  return (
    <div style={{ background: 'var(--bobby-bg-canvas)' }}>
      <div className="mx-auto flex max-w-[740px] items-end gap-2.5 px-4 py-3">
        <div
          className="relative flex flex-1 items-end rounded-2xl border transition-shadow focus-within:shadow-md"
          style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)', boxShadow: 'var(--bobby-shadow-chip)' }}
        >
          <textarea
            ref={ref}
            value={input}
            onChange={onChange}
            onKeyDown={key}
            onClick={onClick}
            onPaste={onPaste}
            onDrop={onDrop}
            placeholder="Describe a task, or try /help /plan /review..."
            rows={1}
            className="min-h-[46px] flex-1 resize-none border-0 bg-transparent px-4 py-3 text-[15px] leading-[1.5] text-bobby-ink outline-none placeholder:text-bobby-faint"
          />
          {menuOpen && menuItems.length > 0 && (
            <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-2xl border p-2 shadow-xl" style={{ background: 'var(--bobby-surface-elevated)', borderColor: 'var(--bobby-border)' }}>
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
        {busy && (
          <button onClick={onAbort} aria-label="Stop current task" className="inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl text-white hover:opacity-90" style={{ background: 'var(--bobby-danger)' }}>
            <Square className="h-4 w-4 fill-current" />
          </button>
        )}
        <button onClick={send} disabled={!input.trim()} className="inline-flex h-[46px] shrink-0 items-center gap-1.5 rounded-xl px-5 text-[14px] font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-40" style={{ background: 'var(--bobby-accent)' }}>
          <Send className="h-4 w-4" />Send
        </button>
      </div>
      <div className="mx-auto flex max-w-[740px] justify-between px-4 pb-2">
        <span className="text-[11px] text-bobby-faint">Ctrl+N new / Ctrl+K clear / /help /plan /review /status /cost /undo</span>
        <span className="text-[11px] text-bobby-faint">Enter to send, Shift+Enter for new line</span>
      </div>
      {notice && <div className="mx-auto max-w-[740px] px-4 pb-2 text-[11px] text-bobby-muted">{notice}</div>}
    </div>
  );
}

function AnimatedLogo() {
  return (
    <div className="mb-6 flex items-center justify-center" style={{ animation: 'bobby-pulse 2s ease-in-out infinite' }}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--bobby-accent)', boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }}>
        <span className="text-2xl font-bold text-white">B</span>
      </div>
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
    <div className="flex flex-col items-center justify-center py-16">
      <AnimatedLogo />
      <div className="mb-2 text-3xl font-bold tracking-tight text-bobby-ink">Hi, I'm Bobby</div>
      <p className="mb-8 text-[15px] text-bobby-muted">Start with a mission, then let the agent plan, act, and prove it.</p>
      <div className="grid max-w-[640px] grid-cols-2 gap-3">
        {cards.map((card) => (
          <button
            key={card.title}
            onClick={() => onPick(card.prompt)}
            className="bobby-empty-hero-card cursor-pointer rounded-2xl border p-4 text-left transition-all hover:border-accent/30 hover:shadow-md"
            style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}
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

const MODE_CONFIG: Record<SessionMode, { label: string; hint: string; rank: number; ariaLabel: string }> = {
  'plan-only': { label: '观察', hint: 'plan-only', rank: 0, ariaLabel: '观察' },
  standard: { label: '标准', hint: 'L1', rank: 1, ariaLabel: '标准' },
  enhanced: { label: '增强', hint: 'L2', rank: 2, ariaLabel: '增强' },
  full: { label: '完全', hint: 'L3', rank: 3, ariaLabel: '完全' }
};

function SessionModeSwitcher({
  mode,
  onChange
}: {
  mode: SessionMode;
  onChange: (mode: SessionMode) => void;
}) {
  const options: SessionMode[] = ['plan-only', 'standard', 'enhanced', 'full'];
  return (
    <div className="mx-auto flex max-w-[740px] items-center gap-2 px-4 pb-2">
      <span className="text-[11px] text-bobby-faint">Mode</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = mode === option;
          const config = MODE_CONFIG[option];
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${active ? 'text-bobby-ink' : 'text-bobby-muted hover:text-bobby-ink'}`}
              style={{
                background: active ? 'var(--bobby-accent-soft)' : 'var(--bobby-surface-card)',
                borderColor: active ? 'var(--bobby-accent)' : 'var(--bobby-border)'
              }}
              aria-label={config.ariaLabel}
              title={`${config.label} (${config.hint})`}
            >
              {config.label}
            </button>
          );
        })}
      </div>
      <span className="ml-auto text-[11px] text-bobby-faint">{MODE_CONFIG[mode].label} / {MODE_CONFIG[mode].hint}</span>
    </div>
  );
}

export function Workspace({ kernelClient, theme = 'light', onThemeChange }: WorkspaceProps) {
  const blocks = useChatStore((s) => s.blocks);
  const liveReasoning = useChatStore((s) => s.liveReasoning);
  const liveAssistant = useChatStore((s) => s.liveAssistant);
  const busy = useChatStore((s) => s.busy);
  const status = useChatStore((s) => s.status);
  const costUsd = useChatStore((s) => s.costUsd);
  const model = useChatStore((s) => s.model);
  const sessionMode = useChatStore((s) => s.sessionMode);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const setClient = useChatStore((s) => s.setClient);
  const handleEvent = useChatStore((s) => s.handleEvent);
  const abort = useChatStore((s) => s.abort);
  const clearBlocks = useChatStore((s) => s.clearBlocks);
  const newSession = useChatStore((s) => s.newSession);
  const setSessionMode = useChatStore((s) => s.setSessionMode);
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    } catch {}
  }, [blocks, liveAssistant, liveReasoning]);

  useEffect(() => {
    if (!kernelClient) return;
    setClient(kernelClient as any);
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
    <div className="flex h-full flex-col" style={{ background: 'var(--bobby-stage-gradient)' }}>
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
        <div className="mx-auto max-w-[740px] px-4 py-5">
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
      <SessionModeSwitcher
        mode={sessionMode}
        onChange={(nextMode) => {
          const nextConfig = MODE_CONFIG[nextMode as SessionMode];
          const currentConfig = MODE_CONFIG[sessionMode];
          if (nextConfig.rank > currentConfig.rank) {
            const ok = window.confirm('Switching to a higher permission mode will allow more execution. Continue?');
            if (!ok) return;
          }
          setSessionMode(nextMode);
        }}
      />
      <Composer kernelClient={kernelClient} onSend={sendMessage} busy={busy} onAbort={abort} />
    </div>
  );
}
