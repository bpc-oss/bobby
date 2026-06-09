import React, { useState, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { useChatStore } from '../store/chat-store';

export function WriteMode({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState(() => {
    try { return localStorage.getItem('bobby-write-draft') || '# New Document\n\nStart writing...'; }
    catch { return '# New Document\n\nStart writing...'; }
  });
  const [title, setTitle] = useState('Untitled');
  const sendMessage = useChatStore(s => s.sendMessage);

  const onChange = useCallback((val: string) => {
    setContent(val);
    try { localStorage.setItem('bobby-write-draft', val); } catch {}
  }, []);

  const askAgent = () => {
    sendMessage('Help me improve this document:\n\n' + content.slice(0, 2000));
  };

  return (
    <div className="flex h-full flex-col bg-bobby-canvas">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--bobby-border-muted)', background: 'var(--bobby-topbar-bg)' }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="rounded-md px-2 py-1 text-[13px] text-bobby-muted hover:text-bobby-ink transition">← Back</button>
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="bg-transparent text-[14px] font-semibold text-bobby-ink outline-none border-0"
            style={{ borderBottom: '2px solid transparent' }} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-bobby-faint">{content.length} chars</span>
          <button onClick={askAgent} className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition" style={{ background: 'var(--bobby-accent)' }}>
            Ask Agent
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={content}
          onChange={onChange}
          extensions={[markdown({ base: markdownLanguage })]}
          theme="none"
          className="h-full text-[15px]"
          style={{ height: '100%', overflow: 'auto' }}
          basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-4 py-1.5" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <span className="text-[11px] text-bobby-faint">Markdown editor · Auto-saved to browser</span>
        <span className="text-[11px] text-bobby-faint">
          {content.split(/\s+/).filter(Boolean).length} words · {content.split('\n').length} lines
        </span>
      </div>
    </div>
  );
}