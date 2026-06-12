import React from 'react';
import {
  Bot,
  CalendarClock,
  Circle,
  CircleDot,
  ChevronDown,
  ChevronRight,
  Clock3,
  Command,
  FolderOpen,
  MessageSquarePlus,
  Puzzle,
  Search,
  Settings2
} from 'lucide-react';
import { useChatStore } from '../store/chat-store';

type SidebarProps = {
  page: 'chat' | 'search' | 'history' | 'plugins' | 'agents' | 'commands' | 'schedule' | 'settings';
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  onPage: (page: 'chat' | 'search' | 'history' | 'plugins' | 'agents' | 'commands' | 'schedule' | 'settings') => void;
  onNewSession: () => void;
};

type ProjectGroup = {
  key: string;
  label: string;
  path: string | null;
  tasks: ReturnType<typeof useChatStore.getState>['threads'][string][];
};

function projectLabel(path: string | null): string {
  if (!path) {
    return 'No project';
  }
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function projectGroupTestId(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function projectGroups(
  threads: ReturnType<typeof useChatStore.getState>['threads'],
  recentProjects: ReturnType<typeof useChatStore.getState>['recentProjects']
): ProjectGroup[] {
  const grouped = new Map<string, ProjectGroup>();

  for (const project of recentProjects) {
    grouped.set(project.path, {
      key: project.path,
      label: project.name,
      path: project.path,
      tasks: []
    });
  }

  for (const thread of Object.values(threads)) {
    const key = thread.projectDir ?? '__no_project__';
    const existing = grouped.get(key);
    if (existing) {
      existing.tasks.push(thread);
      continue;
    }

    grouped.set(key, {
      key,
      label: projectLabel(thread.projectDir),
      path: thread.projectDir,
      tasks: [thread]
    });
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      tasks: group.tasks.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    }))
    .sort((left, right) => {
      const leftUpdated = left.tasks[0] ? new Date(left.tasks[0].updatedAt).getTime() : 0;
      const rightUpdated = right.tasks[0] ? new Date(right.tasks[0].updatedAt).getTime() : 0;
      return rightUpdated - leftUpdated || left.label.localeCompare(right.label);
    });
}

function statusTone(status: string) {
  switch (status) {
    case 'running':
      return {
        icon: CircleDot,
        iconClass: 'animate-pulse',
        iconColor: 'var(--bobby-accent)',
        pillBg: 'var(--bobby-accent-soft)',
        pillFg: 'var(--bobby-accent)'
      };
    case 'failed':
      return {
        icon: Circle,
        iconClass: '',
        iconColor: 'var(--bobby-danger)',
        pillBg: 'var(--bobby-danger-soft)',
        pillFg: 'var(--bobby-danger)'
      };
    case 'blocked':
      return {
        icon: Circle,
        iconClass: '',
        iconColor: '#d97706',
        pillBg: 'rgba(217, 119, 6, 0.14)',
        pillFg: '#d97706'
      };
    case 'done':
      return {
        icon: Circle,
        iconClass: '',
        iconColor: 'var(--bobby-success)',
        pillBg: 'var(--bobby-success-soft)',
        pillFg: 'var(--bobby-success)'
      };
    default:
      return {
        icon: Circle,
        iconClass: '',
        iconColor: 'var(--bobby-text-faint)',
        pillBg: 'var(--bobby-surface-hover)',
        pillFg: 'var(--bobby-text-muted)'
      };
  }
}

function RailButton({
  active,
  disabled = false,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[13px] transition ${
        disabled ? 'cursor-not-allowed opacity-45' : ''
      }`}
      style={{
        background: active ? 'var(--bobby-sidebar-row-active)' : 'transparent',
        color: active ? 'var(--bobby-text)' : 'var(--bobby-text-muted)',
        boxShadow: active ? 'inset 0 0 0 1px var(--bobby-sidebar-row-ring)' : 'none'
      }}
      title={label}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function Sidebar({ page, theme, onThemeChange, onPage, onNewSession }: SidebarProps): React.ReactElement {
  const threads = useChatStore((s) => s.threads);
  const currentProject = useChatStore((s) => s.currentProject);
  const recentProjects = useChatStore((s) => s.recentProjects);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const newSession = useChatStore((s) => s.newSession);
  const switchSession = useChatStore((s) => s.switchSession);

  const groups = React.useMemo(() => projectGroups(threads, recentProjects), [threads, recentProjects]);
  const activeProjectPath = currentProject?.path ?? (activeSessionId ? threads[activeSessionId]?.projectDir ?? null : null);
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});

  const groupCollapsed = React.useCallback(
    (group: ProjectGroup) => {
      if (collapsedGroups[group.key] !== undefined) {
        return collapsedGroups[group.key];
      }
      return false;
    },
    [collapsedGroups]
  );

  const toggleGroup = React.useCallback((groupKey: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey]
    }));
  }, []);

  const primaryItems: Array<{
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    active: boolean;
    disabled?: boolean;
    onClick?: () => void;
  }> = [
    {
      key: 'new-task',
      label: 'New Chat',
      icon: MessageSquarePlus,
      active: page === 'chat' && !activeSessionId,
      onClick: () => {
        newSession();
        onNewSession();
      }
    },
    {
      key: 'search',
      label: 'Search',
      icon: Search,
      active: page === 'search',
      onClick: () => onPage('search')
    },
    {
      key: 'plugins',
      label: 'Plugins',
      icon: Puzzle,
      active: page === 'plugins',
      onClick: () => onPage('plugins')
    },
    {
      key: 'schedule',
      label: 'Automations',
      icon: CalendarClock,
      active: page === 'schedule',
      onClick: () => onPage('schedule')
    }
  ];

  const secondaryItems = [
    { key: 'history', label: 'History', icon: Clock3, active: page === 'history', onClick: () => onPage('history') },
    { key: 'agents', label: 'Agents', icon: Bot, active: page === 'agents', onClick: () => onPage('agents') },
    { key: 'commands', label: 'Commands', icon: Command, active: page === 'commands', onClick: () => onPage('commands') }
  ];

  return (
    <aside
      data-testid="sidebar"
      className="flex h-full w-[358px] shrink-0 border-r"
      style={{
        background: 'var(--bobby-sidebar-gradient)',
        borderColor: 'var(--bobby-sidebar-border)',
        boxShadow: 'var(--bobby-sidebar-shadow)'
      }}
    >
      <div
        data-testid="activity-rail"
        className="flex w-[104px] shrink-0 flex-col border-r px-3 py-4"
        style={{ borderColor: 'var(--bobby-sidebar-divider)' }}
      >
        <div className="mb-4 px-1 text-[12px] font-semibold uppercase tracking-[0.24em] text-bobby-faint">Bobby</div>
        <div className="space-y-1.5">
          {primaryItems.map((item) => (
            <RailButton key={item.key} active={item.active} disabled={item.disabled} icon={item.icon} label={item.label} onClick={item.onClick} />
          ))}
        </div>
        <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--bobby-sidebar-divider)' }}>
          <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-bobby-faint">Tools</div>
          <div className="space-y-1.5">
            {secondaryItems.map((item) => (
              <RailButton key={item.key} active={item.active} icon={item.icon} label={item.label} onClick={item.onClick} />
            ))}
          </div>
        </div>
        <div className="mt-auto space-y-2">
          <button
            type="button"
            onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
            className="w-full rounded-2xl px-3 py-2 text-left text-[12px] text-bobby-muted transition hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
          >
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
          <RailButton active={page === 'settings'} icon={Settings2} label="Settings" onClick={() => onPage('settings')} />
        </div>
      </div>

      <div data-testid="project-task-navigator" className="flex min-w-0 flex-1 flex-col">
        <div className="border-b px-4 py-4" style={{ borderColor: 'var(--bobby-sidebar-divider)' }}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bobby-faint">Projects</div>
              <div className="mt-1 text-[14px] font-semibold text-bobby-ink">
                {currentProject?.name ?? projectLabel(activeProjectPath)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                newSession();
                onNewSession();
              }}
              className="rounded-xl border px-2.5 py-1.5 text-[12px] font-medium text-bobby-muted transition hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
              style={{ borderColor: 'var(--bobby-sidebar-divider)' }}
            >
              New Task
            </button>
          </div>
          <div className="text-[12px] text-bobby-faint">
            {groups.length} project groups, {Object.keys(threads).length} tracked threads
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {groups.length === 0 && (
            <div className="rounded-2xl border px-4 py-4 text-[13px] text-bobby-faint" style={{ borderColor: 'var(--bobby-sidebar-divider)' }}>
              No projects or task threads yet.
            </div>
          )}

          <div className="space-y-3">
            {groups.map((group) => (
              <section
                key={group.key}
                data-testid={`project-group-${projectGroupTestId(group.key)}`}
                className="rounded-2xl border px-2 py-2"
                style={{
                  borderColor: group.path === activeProjectPath ? 'var(--bobby-accent)' : 'var(--bobby-sidebar-divider)',
                  background: group.path === activeProjectPath ? 'var(--bobby-accent-soft)' : 'var(--bobby-card-ghost)'
                }}
              >
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <button
                    type="button"
                    data-testid={`project-group-toggle-${projectGroupTestId(group.key)}`}
                    aria-label={`${group.label} task group`}
                    aria-expanded={!groupCollapsed(group)}
                    onClick={() => toggleGroup(group.key)}
                    className="rounded-md p-0.5 text-bobby-faint transition hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
                  >
                    {groupCollapsed(group) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  <FolderOpen className="h-4 w-4 text-bobby-faint" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-bobby-ink">{group.label}</div>
                    <div className="truncate text-[11px] text-bobby-faint">{group.path ?? 'No project context'}</div>
                  </div>
                  <div className="rounded-full px-2 py-0.5 text-[10px] font-medium text-bobby-muted" style={{ background: 'var(--bobby-surface-hover)' }}>
                    {group.tasks.length}
                  </div>
                </div>

                {!groupCollapsed(group) && (
                  <div className="mt-1 space-y-1">
                    {group.tasks.length === 0 && (
                      <div className="px-3 py-2 text-[12px] text-bobby-faint">No task threads yet.</div>
                    )}
                    {group.tasks.map((task) => {
                      const tone = statusTone(task.status);
                      const StatusIcon = tone.icon;
                      const active = task.id === activeSessionId;
                      return (
                        <button
                          key={task.id}
                          type="button"
                          data-testid={`sidebar-task-${task.id}`}
                          onClick={() => {
                            if (task.id !== activeSessionId) {
                              switchSession(task.id);
                            }
                            onPage('chat');
                          }}
                          className="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition"
                          style={{
                            background: active ? 'var(--bobby-card-strong)' : 'transparent',
                            boxShadow: active ? 'inset 0 0 0 1px var(--bobby-sidebar-row-ring)' : 'none'
                          }}
                          title={task.taskId ? `${task.title} / ${task.taskId}` : task.title}
                        >
                          <StatusIcon className={`mt-1 h-3.5 w-3.5 shrink-0 ${tone.iconClass}`} style={{ color: tone.iconColor }} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12px] font-medium text-bobby-ink">{task.title}</div>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-bobby-faint">
                              <span data-testid={`sidebar-task-status-${task.id}`}>{task.status}</span>
                              <span className="truncate">{task.taskId ?? task.id}</span>
                            </div>
                          </div>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{ background: tone.pillBg, color: tone.pillFg }}
                          >
                            {task.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
