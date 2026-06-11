import React from 'react';
import { Bot, CalendarClock, Clock3, Command, MessageSquare, Plus, Puzzle, Settings2 } from 'lucide-react';
import { useChatStore } from '../store/chat-store';

type SidebarProps = {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  onPage: (page: 'chat' | 'history' | 'plugins' | 'agents' | 'commands' | 'schedule' | 'claw' | 'settings') => void;
  onNewSession: () => void;
};

export function Sidebar({ theme, onThemeChange, onPage, onNewSession }: SidebarProps): React.ReactElement {
  const threads = useChatStore((s) => s.threads);
  const busy = useChatStore((s) => s.busy);
  const status = useChatStore((s) => s.status);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const newSession = useChatStore((s) => s.newSession);
  const switchSession = useChatStore((s) => s.switchSession);

  const tasks = React.useMemo(
    () => Object.values(threads).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [threads]
  );
  const activeThread = activeSessionId ? threads[activeSessionId] : null;

  const toolbar = [
    { key: 'plugins', title: 'Plugins', icon: Puzzle, onClick: () => onPage('plugins') },
    { key: 'agents', title: 'Agents', icon: Bot, onClick: () => onPage('agents') },
    { key: 'commands', title: 'Commands', icon: Command, onClick: () => onPage('commands') },
    { key: 'schedule', title: 'Automations', icon: CalendarClock, onClick: () => onPage('schedule') },
    { key: 'history', title: 'History', icon: Clock3, onClick: () => onPage('history') },
    { key: 'chat', title: 'Chat', icon: MessageSquare, onClick: () => onPage('chat') },
    { key: 'settings', title: 'Settings', icon: Settings2, onClick: () => onPage('settings') }
  ];

  return (
    <aside
      data-testid="sidebar"
      className="flex h-full w-[260px] flex-col border-r"
      style={{ background: 'var(--bobby-bg-sidebar)', borderColor: 'var(--bobby-sidebar-border)' }}
    >
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--bobby-sidebar-divider)' }}>
        <h1 className="select-none text-[13px] font-bold text-bobby-ink">Bobby</h1>
        <div className="flex items-center gap-1">
          {toolbar.map(({ key, title, icon: Icon, onClick }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[14px] text-bobby-muted hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
              title={title}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              newSession();
              onNewSession();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[14px] text-bobby-muted hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
            title="New task thread"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-b px-4 py-2.5" style={{ borderColor: 'var(--bobby-sidebar-divider)' }}>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{
              background: activeThread?.status === 'running' || busy ? 'var(--bobby-accent)' : activeThread?.status && activeThread.status !== 'idle' ? 'var(--bobby-success)' : 'var(--bobby-border)'
            }}
          />
          <span className="text-[12px] text-bobby-muted">{activeThread?.status === 'running' || busy ? 'Working...' : activeThread?.status === 'idle' || status === 'idle' ? 'Ready' : activeThread?.status ?? status}</span>
        </div>
      </div>

      <div data-testid="sidebar-task-list" className="flex-1 overflow-y-auto px-2 py-3">
        <h2 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-bobby-faint">Tasks</h2>
        {tasks.length === 0 && <p className="px-2 text-[12px] text-bobby-faint">No tasks yet</p>}
        <div className="space-y-0.5">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              data-testid={`sidebar-task-${task.id}`}
              onClick={() => {
                if (task.id !== activeSessionId) switchSession(task.id);
              }}
              className="flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left text-[12px] text-bobby-ink transition hover:bg-bobby-sidebar-row-hover"
              style={task.id === activeSessionId ? { background: 'var(--bobby-sidebar-row-active)' } : undefined}
              title={task.taskId ? `${task.title} / ${task.taskId}` : task.title}
            >
              <div className="flex items-center gap-2">
                <span data-testid={`sidebar-task-status-${task.id}`} className="sr-only">{task.status}</span>
                <span className="min-w-0 flex-1 truncate">
                  {task.title.slice(0, 55)}
                  {task.title.length > 55 ? '...' : ''}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    background:
                      task.status === 'running'
                        ? 'var(--bobby-accent-soft)'
                        : task.status === 'failed'
                          ? 'var(--bobby-danger-soft)'
                          : task.status === 'blocked'
                            ? 'rgba(217, 119, 6, 0.16)'
                            : 'var(--bobby-hover)',
                    color:
                      task.status === 'running'
                        ? 'var(--bobby-accent)'
                        : task.status === 'failed'
                          ? 'var(--bobby-danger)'
                          : task.status === 'blocked'
                            ? '#d97706'
                            : 'var(--bobby-muted)'
                  }}
                >
                  {task.status}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-bobby-faint">
                <span className="truncate">{task.projectDir ? task.projectDir.split(/[\\/]/).filter(Boolean).at(-1) ?? task.projectDir : 'No project'}</span>
                <span className="shrink-0">{task.taskId ?? task.id}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t px-3 py-2" style={{ borderColor: 'var(--bobby-sidebar-divider)' }}>
        <button
          type="button"
          onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
          className="w-full rounded-lg px-3 py-1.5 text-left text-[12px] text-bobby-muted transition hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
        >
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
      </div>
    </aside>
  );
}
