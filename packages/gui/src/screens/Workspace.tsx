import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { KernelEvent } from '@bobby/shared';
import { useChatStore, type ChatBlock } from '../store/chat-store';
import { PlanView } from '../components/PlanView';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { Send, Square, Pencil, ChevronRight, Lightbulb, FileText, Zap, Search } from 'lucide-react';

type WP = {
  kernelClient?: { startTask: (input: string) => Promise<unknown>; approveGate?: (gateId: string, decision: string) => Promise<unknown>; onEvent: (cb: (event: KernelEvent) => void) => () => void };
  theme?: 'light' | 'dark'; onThemeChange?: (t: 'light' | 'dark') => void;
};

function UserBubble({ text }: { text: string }) {
  const busy = useChatStore(s => s.busy);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (!edit) return; const el = ref.current; if (!el) return; el.focus(); el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 360) + 'px'; }, [edit]);
  const submit = async () => { const t = draft.trim(); if (t && !busy) setEdit(false); };

  if (edit) {
    return (
      <div className='mb-5 flex flex-col items-end'>
        <div className='min-w-0 w-full max-w-[82%] border border-accent/35 ring-1 ring-accent/15' style={{ background: 'var(--bobby-surface-card)', borderRadius: 18, padding: '12px 16px' }}>
          <textarea ref={ref} value={draft} onChange={e => { setDraft(e.target.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 360) + 'px'; }}
            onKeyDown={e => { if (e.key === 'Escape') { setDraft(text); setEdit(false); } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); } }}
            rows={2} className='block w-full min-w-0 resize-none break-words bg-transparent text-[15px] font-medium leading-[1.58] text-bobby-ink outline-none' />
          <div className='mt-2 flex items-center justify-between gap-3'>
            <span className='text-[12px] text-bobby-faint'>Esc to cancel, Cmd+Enter to resend</span>
            <div className='flex items-center gap-2'>
              <button onClick={() => { setDraft(text); setEdit(false); }} className='rounded-md px-3 py-1 text-[13px] font-medium text-bobby-muted hover:bg-bobby-hover hover:text-bobby-ink'>Cancel</button>
              <button onClick={() => void submit()} disabled={!draft.trim() || busy} className='rounded-md bg-accent px-3 py-1 text-[13px] font-medium text-white shadow-sm hover:brightness-110 disabled:opacity-50'>Resend</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className='group relative mb-5 flex flex-col items-end'>
      <div className='max-w-[82%] cursor-pointer' style={{ background: 'var(--bobby-bubble-user)', color: 'var(--bobby-bubble-user-fg)', borderRadius: '18px 18px 6px 18px', padding: '10px 16px' }}
        onDoubleClick={() => { if (!busy) { setDraft(text); setEdit(true); } }}>
        <span className='whitespace-pre-wrap break-words text-[15px] font-medium leading-[1.58]'>{text}</span>
      </div>
      <div className='mt-1 flex items-center opacity-0 transition-opacity group-hover:opacity-100'>
        <button onClick={() => { setDraft(text); setEdit(true); }} disabled={busy}
          className='inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] text-bobby-faint hover:bg-bobby-hover hover:text-bobby-ink disabled:opacity-40'>
          <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/></svg>Edit
        </button>
      </div>
      <div className="mx-auto flex max-w-[740px] justify-between px-4 pb-2">
        <span className="text-[11px] text-bobby-faint">Ctrl+N new ? Ctrl+K clear ? /help /plan /review</span>
        <span className="text-[11px] text-bobby-faint">Enter to send, Shift+Enter for new line</span>
      </div>
    </div>
  );
}

function AssistantBubble({ text, streaming }: { text: string; streaming?: boolean }) {
  if (!text.trim()) return <></>;
  return <div className='bobby-assistant-block mb-5'><div className='bobby-markdown px-1'><MarkdownRenderer content={text} streaming={streaming} /></div></div>;
}

function ReasoningBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className='mb-4 rounded-2xl border border-bobby-border-muted' style={{ background: 'var(--bobby-surface-subtle)' }}>
      <button onClick={() => setOpen(!open)} className='flex w-full items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-bobby-muted hover:text-bobby-ink'>
        <svg className={open ? 'rotate-90' : ''} width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'><polyline points='9 18 15 12 9 6'/></svg>
        <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><circle cx='12' cy='12' r='10'/><path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'/><line x1='12' y1='17' x2='12.01' y2='17'/></svg>
        Thinking
      </button>
      {open && <div className='border-t border-bobby-border-muted px-4 py-3 text-[13px] leading-[1.65] text-bobby-muted whitespace-pre-wrap font-mono max-h-[360px] overflow-y-auto'>{text}</div>}
    </div>
  );
}

function ToolRow({ block }: { block: ChatBlock & { kind: 'tool' } }) {
  const done = block.status === 'done';
  const bg = done ? 'var(--bobby-success-soft)' : 'var(--bobby-surface-subtle)';
  const bd = done ? 'var(--bobby-success-soft)' : 'var(--bobby-border-muted)';
  const col = done ? 'var(--bobby-success)' : 'var(--bobby-text-muted)';
  return (
    <div className='mb-2.5 flex items-start gap-2 rounded-xl px-4 py-2.5 text-[13px] font-mono' style={{ background: bg, border: '1px solid ' + bd }}>
      <span className='mt-0.5' style={{ color: col }}>{done ? '✓' : block.status === 'running' ? '◉' : '○'}</span>
      <span className='font-medium text-bobby-ink'>{block.tool}</span>
      {block.content && <span className='text-bobby-muted ml-auto pl-2 max-w-[40%] truncate'>{block.content}</span>}
    </div>
  );
}

function EvidenceRow({ block }: { block: ChatBlock & { kind: 'evidence' } }) {
  const e = block.evidence; const p = e.payload as any;
  const pass = e.evidenceType === 'command_output' ? p?.exitCode === 0 : true;
  const bg = pass ? 'var(--bobby-success-soft)' : 'var(--bobby-danger-soft)';
  const bd = pass ? 'var(--bobby-success-soft)' : 'var(--bobby-danger-soft)';
  return (
    <div className='mb-2.5 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-mono' style={{ background: bg, border: '1px solid ' + bd, color: pass ? 'var(--bobby-success)' : 'var(--bobby-danger)' }}>
      <span>{pass ? '✓' : '✗'}</span>
      <span className='text-bobby-ink'>{e.acId}/{e.evidenceType}</span>
      {p && <span className='text-bobby-muted ml-auto pl-2 max-w-[40%] truncate'>{p.path || p.stdout || ''}</span>}
    </div>
  );
}
function StatusBanner({ block }: { block: ChatBlock & { kind: 'status' } }) {
  const m: any = {
    done: { bg: 'var(--bobby-success-soft)', bc: 'var(--bobby-success)', c: 'var(--bobby-success)', label: 'Completed' },
    failed: { bg: 'var(--bobby-danger-soft)', bc: 'var(--bobby-danger)', c: 'var(--bobby-danger)', label: 'Failed' },
    blocked: { bg: 'var(--bobby-surface-subtle)', bc: 'var(--bobby-border)', c: 'var(--bobby-text-muted)', label: 'Blocked' },
  };
  const s = m[block.status] ?? m.done;
  return <div className='mb-5 rounded-2xl px-5 py-3 text-[14px] font-semibold' style={{ background: s.bg, border: '1px solid ' + s.bc, color: s.c }}>{s.label}</div>;
}

function ChatRow({ block }: { block: ChatBlock }) {
  switch (block.kind) {
    case 'user': return <UserBubble text={block.text} />;
    case 'reasoning': return <ReasoningBlock text={block.text} />;
    case 'assistant': return <AssistantBubble text={block.text} />;
    case 'tool': return <ToolRow block={block} />;
    case 'evidence': return <EvidenceRow block={block} />;
    case 'verdict': return <div className='mb-2.5 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px]' style={{ background: 'var(--bobby-danger-soft)', border: '1px solid var(--bobby-danger-soft)', color: 'var(--bobby-danger)' }}><span>✗</span><span className='text-bobby-ink font-medium'>{block.acId}: {block.result}</span></div>;
    case 'plan': return <div className='bobby-panel mb-5 p-4'><div className='text-[13px] font-semibold text-bobby-ink'>Plan</div><div className='mt-1 text-[13px] text-bobby-muted'>{block.steps.length} steps</div></div>;
    case 'status': return <StatusBanner block={block} />;
    case 'error': return <div className='mb-5 rounded-xl px-5 py-3 text-[14px] font-medium' style={{ background: 'var(--bobby-danger-soft)', border: '1px solid var(--bobby-danger-soft)', color: 'var(--bobby-danger)' }}>{block.message}</div>;
    default: return <></>;
  }
}

function Composer({ onSend, busy, onAbort }: { onSend: (t: string) => void; busy: boolean; onAbort: () => void }) {
  const [input, setInput] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const processCommand = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (trimmed.startsWith('/')) {
      const cmd = trimmed.split(' ')[0].toLowerCase();
      const store = useChatStore.getState();
      switch (cmd) {
        case '/clear': store.clearBlocks(); break;
        case '/help': onSend('help'); break;
        case '/plan': onSend('Create a detailed plan for this project'); break;
        case '/review': onSend('Review the code changes and identify bugs'); break;
        default: onSend(trimmed); break;
      }
    } else {
      onSend(trimmed);
    }
    setInput('');
    ref.current?.focus();
  }, [input, busy, onSend]);

  const send = useCallback(() => processCommand(input), [input, processCommand]);
  const key = useCallback((e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); processCommand(input); } }, [input, processCommand]);
  useEffect(() => { if (!busy) ref.current?.focus(); }, [busy]);
  return (
    <div style={{ background: 'var(--bobby-bg-canvas)' }}>
      <div className='mx-auto flex max-w-[740px] items-end gap-2.5 px-4 py-3'>
        <div className='relative flex flex-1 items-end rounded-2xl border transition-shadow focus-within:shadow-md'
          style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)', boxShadow: 'var(--bobby-shadow-chip)' }}>
          <textarea ref={ref} value={input} onChange={e => setInput(e.target.value)} onKeyDown={key}
            placeholder={busy ? 'Agent is working...' : 'Describe a task, or try /help /plan /review...'}
            disabled={busy} rows={1}
            className='min-h-[46px] flex-1 resize-none border-0 bg-transparent px-4 py-3 text-[15px] leading-[1.5] text-bobby-ink placeholder:text-bobby-faint outline-none' />
        </div>
        {busy
          ? <button onClick={onAbort} className='inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl text-white hover:opacity-90' style={{ background: 'var(--bobby-danger)' }}><div className='h-4 w-4 rounded-sm bg-white' /></button>
          : <button onClick={send} disabled={!input.trim()} className='inline-flex h-[46px] shrink-0 items-center gap-1.5 rounded-xl px-5 text-[14px] font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-40' style={{ background: 'var(--bobby-accent)' }}>
              <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round'><line x1='12' y1='19' x2='12' y2='5'/><polyline points='5 12 12 5 19 12'/></svg>Send
            </button>}
      </div>
    </div>
  );
}


function AnimatedLogo() {
  return React.createElement('div', {
    className: 'mb-6 flex items-center justify-center',
    style: { animation: 'bobby-pulse 2s ease-in-out infinite' }
  },
    React.createElement('div', {
      className: 'flex h-16 w-16 items-center justify-center rounded-2xl',
      style: { background: 'var(--bobby-accent)', boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }
    },
      React.createElement('span', { className: 'text-2xl font-bold text-white', style: { letterSpacing: '-0.5px' } }, 'B')
    )
  );
}

function SuggestionCards({ onPick }: { onPick: (t: string) => void }) {
  const cards = [
    { icon: FileText, title: 'Create a file', sub: 'hello.txt with hello world', prompt: 'Create hello.txt with hello world' },
    { icon: Search, title: 'Review changes', sub: 'Check my git diff for bugs', prompt: 'Review the git diff for potential bugs' },
    { icon: Zap, title: 'Run a command', sub: 'npm test and fix failures', prompt: 'Run npm test and fix any failures' },
    { icon: Lightbulb, title: 'Explain code', sub: 'How does this module work?', prompt: 'Explain how the current directory is structured' },
  ];
  return React.createElement('div', { className: 'flex flex-col items-center justify-center py-16' },
    React.createElement(AnimatedLogo),
    React.createElement('div', { className: 'text-3xl font-bold tracking-tight text-bobby-ink mb-2' }, "Hi, I'm Bobby"),
    React.createElement('p', { className: 'text-[15px] text-bobby-muted mb-8' }, 'Your local coding agent with evidence gates.'),
    React.createElement('div', { className: 'grid grid-cols-2 gap-3 max-w-[480px]' },
      ...cards.map(c => React.createElement('button', {
        key: c.title,
        onClick: () => onPick(c.prompt),
        className: 'bobby-empty-hero-card rounded-2xl border p-4 text-left cursor-pointer transition-all hover:shadow-md hover:border-accent/30',
        style: { background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }
      },
        React.createElement(c.icon, { className: 'w-5 h-5 mb-2', style: { color: 'var(--bobby-accent)' } }),
        React.createElement('div', { className: 'text-[13px] font-semibold text-bobby-ink' }, c.title),
        React.createElement('div', { className: 'text-[12px] text-bobby-muted mt-0.5' }, c.sub)
      ))
    )
  );
}

export function Workspace({ kernelClient, theme = 'light', onThemeChange }: WP) {
  const blocks = useChatStore(s => s.blocks);
  const liveReasoning = useChatStore(s => s.liveReasoning);
  const liveAssistant = useChatStore(s => s.liveAssistant);
  const busy = useChatStore(s => s.busy);
  const status = useChatStore(s => s.status);
  const costUsd = useChatStore(s => s.costUsd);
  const model = useChatStore(s => s.model);
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const sendMessage = useChatStore(s => s.sendMessage);
  const setClient = useChatStore(s => s.setClient);
  const handleEvent = useChatStore(s => s.handleEvent);
  const abort = useChatStore(s => s.abort);
  const clearBlocks = useChatStore(s => s.clearBlocks);
  const newSession = useChatStore(s => s.newSession);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { try { bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' }); } catch {} }, [blocks, liveAssistant, liveReasoning]);
  useEffect(() => { if (!kernelClient) return; setClient(kernelClient as any); return () => setClient(null); }, [kernelClient, setClient]);
  useEffect(() => { if (!kernelClient) return; return kernelClient.onEvent(handleEvent); }, [kernelClient, handleEvent]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'k') { e.preventDefault(); clearBlocks(); }
      if (mod && e.key === 'n') { e.preventDefault(); newSession(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [clearBlocks, newSession]);

  return (
    <div className='flex h-full flex-col' style={{ background: 'var(--bobby-stage-gradient)' }}>
      <div style={{ background: 'var(--bobby-topbar-bg)', boxShadow: 'var(--bobby-topbar-shadow)', borderBottom: '1px solid var(--bobby-border-muted)' }}>
        <div className='flex items-center justify-between px-4 py-2.5'>
          <div className='flex items-center gap-3'>
            <h2 className='text-[13px] font-bold tracking-tight text-bobby-ink select-none'>Bobby</h2>
            {busy && <span className='inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold' style={{ background: 'var(--bobby-accent-soft)', color: 'var(--bobby-accent)' }}><span className='inline-block h-1.5 w-1.5 rounded-full animate-pulse' style={{ background: 'var(--bobby-accent)' }}/>Working</span>}
            {!busy && status !== 'idle' && <span className='text-[12px] text-bobby-muted capitalize'>{status}</span>}
          </div>
          <div className='flex items-center gap-3 text-[12px] text-bobby-muted'>
            {model && <span>{model}</span>}
            {costUsd > 0 && <span>${costUsd.toFixed(4)}</span>}
            <button onClick={() => onThemeChange?.(theme === 'light' ? 'dark' : 'light')} className='rounded-md px-2 py-1 hover:text-bobby-ink'
            >{theme === 'light' ? '🌙' : '☀️'}</button>
            <div className="relative">
              <button onClick={() => setShowModelPicker(!showModelPicker)}
                className='flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-bobby-muted hover:text-bobby-ink hover:bg-bobby-hover transition'
              >{selectedModel === 'deepseek-chat' ? 'V3' : 'R1'} <span className='text-[10px]'>{showModelPicker ? '?' : '?'}</span></button>
              {showModelPicker && React.createElement('div', {
                className: 'absolute right-0 top-full mt-1 w-48 rounded-xl border py-1 z-20 shadow-lg',
                style: { background: 'var(--bobby-surface-elevated)', borderColor: 'var(--bobby-border)' }
              },
                React.createElement('button', {
                  onClick: () => { setSelectedModel('deepseek-chat'); setShowModelPicker(false); },
                  className: 'w-full text-left px-3 py-2 text-[13px] hover:bg-bobby-hover transition' + (selectedModel === 'deepseek-chat' ? ' text-bobby-ink font-medium' : ' text-bobby-muted')
                }, 'DeepSeek Chat (V3)'),
                React.createElement('button', {
                  onClick: () => { setSelectedModel('deepseek-reasoner'); setShowModelPicker(false); },
                  className: 'w-full text-left px-3 py-2 text-[13px] hover:bg-bobby-hover transition' + (selectedModel === 'deepseek-reasoner' ? ' text-bobby-ink font-medium' : ' text-bobby-muted')
                }, 'DeepSeek Reasoner (R1)')
              )}</div>
          </div>
        </div>
      </div>
      <div className='mx-4 border-t' style={{ borderColor: 'var(--bobby-border-muted)' }} />
      <div className='flex-1 overflow-y-auto'>
        <div className='mx-auto max-w-[740px] px-4 py-5'>
          {blocks.length === 0 && !busy && React.createElement(SuggestionCards, { onPick: sendMessage })}
          {blocks.map(b => React.createElement(ChatRow, { key: b.id, block: b }))}
          {busy && <>
            {liveReasoning && <ReasoningBlock text={liveReasoning} />}
            {liveAssistant && <AssistantBubble text={liveAssistant} streaming />}
          </>}
          <style>{'@keyframes bobby-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}'}</style>
          <div ref={bottomRef} />
        </div>
      </div>
      <Composer onSend={sendMessage} busy={busy} onAbort={abort} />
    </div>
  );
}
