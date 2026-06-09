import React from 'react';
import { useChatStore } from '../store/chat-store';

type SidebarProps = {
  onNewSession: () => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
};

export function Sidebar({ onNewSession, theme, onThemeChange }: SidebarProps): React.ReactElement {
  const status = useChatStore((s) => s.status);
  const blocks = useChatStore((s) => s.blocks);
  const busy = useChatStore((s) => s.busy);

  const userMessages = blocks.filter((b) => b.kind === 'user');

  return (
    <aside className="flex h-full w-64 flex-col border-r border-bobby-border bg-bobby-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-bobby-border px-4 py-3">
        <h1 className="text-sm font-bold text-bobby-ink">Bobby</h1>
        <button
          onClick={onNewSession}
          disabled={busy}
          className="rounded-lg bg-bobby-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          + New
        </button>
      </div>

      {/* Status */}
      <div className="border-b border-bobby-border px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-bobby-muted">
          <span className={`inline-block h-2 w-2 rounded-full ${busy ? 'bg-bobby-accent animate-pulse' : status === 'idle' ? 'bg-bobby-muted' : 'bg-bobby-success'}`} />
          {busy ? 'Working...' : status === 'idle' ? 'Ready' : status}
        </div>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-bobby-faint">Sessions</h2>
        {userMessages.length === 0 ? (
          <p className="px-2 text-xs text-bobby-muted">No sessions yet</p>
        ) : (
          <ul className="space-y-0.5">
            {userMessages.slice(0, 20).map((msg, i) => (
              <li key={msg.id} className="truncate rounded-lg px-2 py-1.5 text-xs text-bobby-ink hover:bg-bobby-hover cursor-pointer transition-colors">
                {msg.text.slice(0, 60)}{msg.text.length > 60 ? '...' : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-bobby-border px-4 py-2">
        <button
          onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
          className="w-full rounded-lg px-3 py-1.5 text-xs text-bobby-muted hover:text-bobby-ink hover:bg-bobby-hover transition-colors text-left"
        >
          {theme === 'light' ? '🌙 Dark mode' : '☀️ Light mode'}
        </button>
      </div>
    </aside>
  );
}