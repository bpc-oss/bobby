import React from 'react';
import { Bot, Command, FolderOpen, Puzzle, Search as SearchIcon } from 'lucide-react';
import { useChatStore } from '../store/chat-store';
import type {
  CommandRecordDto,
  McpServerRecordDto,
  ProjectMeta,
  SessionRecordDto,
  SubAgentRecordDto,
  TaskSummary,
  WorkspaceFileSearchEntry
} from '../ipc/contract';

type SearchClient = {
  listProjects?: () => Promise<ProjectMeta[]>;
  listSessions?: () => Promise<SessionRecordDto[]>;
  listTasks?: () => Promise<TaskSummary[]>;
  listCommands?: () => Promise<CommandRecordDto[]>;
  listMcpServers?: () => Promise<McpServerRecordDto[]>;
  listSubAgents?: () => Promise<SubAgentRecordDto[]>;
  searchFiles?: (query: string) => Promise<WorkspaceFileSearchEntry[]>;
};

type SearchResult =
  | { id: string; group: 'Projects'; title: string; detail: string; onSelect: () => void }
  | { id: string; group: 'Tasks'; title: string; detail: string; onSelect: () => void }
  | { id: string; group: 'Files'; title: string; detail: string; onSelect: () => void }
  | { id: string; group: 'Commands'; title: string; detail: string; onSelect: () => void }
  | { id: string; group: 'Plugins & Tools'; title: string; detail: string; onSelect: () => void };

type SearchScreenProps = {
  client?: SearchClient | null;
  onSelectProject: (path: string) => void | Promise<void>;
  onSelectSession: (sessionId: string) => void;
  onOpenFile: (path: string) => void;
  onInsertCommand: (name: string) => void;
};

function includesQuery(value: string | null | undefined, query: string): boolean {
  return Boolean(value && value.toLowerCase().includes(query));
}

function sanitizeTestIdSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function resultTestId(id: string): string {
  const [kind, ...rest] = id.split(':');
  return `search-result-${kind}-${sanitizeTestIdSegment(rest.join(':'))}`;
}

export function SearchScreen({
  client,
  onSelectProject,
  onSelectSession,
  onOpenFile,
  onInsertCommand
}: SearchScreenProps): React.ReactElement {
  const recentProjects = useChatStore((s) => s.recentProjects);
  const threads = useChatStore((s) => s.threads);
  const [query, setQuery] = React.useState('');
  const [files, setFiles] = React.useState<WorkspaceFileSearchEntry[]>([]);
  const [commands, setCommands] = React.useState<CommandRecordDto[]>([]);
  const [projects, setProjects] = React.useState<ProjectMeta[]>(recentProjects);
  const [sessions, setSessions] = React.useState<SessionRecordDto[]>(Object.values(threads));
  const [tasks, setTasks] = React.useState<TaskSummary[]>([]);
  const [servers, setServers] = React.useState<McpServerRecordDto[]>([]);
  const [subAgents, setSubAgents] = React.useState<SubAgentRecordDto[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    setProjects(recentProjects);
  }, [recentProjects]);

  React.useEffect(() => {
    setSessions(Object.values(threads));
  }, [threads]);

  React.useEffect(() => {
    if (!client) return;
    void client.listProjects?.().then((items) => setProjects(items)).catch(() => undefined);
    void client.listSessions?.().then((items) => setSessions(items)).catch(() => undefined);
    void client.listTasks?.().then((items) => setTasks(items)).catch(() => undefined);
    void client.listCommands?.().then((items) => setCommands(items)).catch(() => undefined);
    void client.listMcpServers?.().then((items) => setServers(items)).catch(() => undefined);
    void client.listSubAgents?.().then((items) => setSubAgents(items)).catch(() => undefined);
  }, [client]);

  React.useEffect(() => {
    if (!client?.searchFiles || !query.trim()) {
      setFiles([]);
      return;
    }

    let active = true;
    void client.searchFiles(query.trim()).then((items) => {
      if (active) setFiles(items);
    }).catch(() => {
      if (active) setFiles([]);
    });
    return () => {
      active = false;
    };
  }, [client, query]);

  const results = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return [] as SearchResult[];
    }

    const nextResults: SearchResult[] = [];

    for (const project of projects) {
      if (includesQuery(project.name, normalized) || includesQuery(project.path, normalized)) {
        nextResults.push({
          id: `project:${project.path}`,
          group: 'Projects',
          title: project.name,
          detail: project.path,
          onSelect: () => void onSelectProject(project.path)
        });
      }
    }

    for (const session of sessions) {
      if (
        includesQuery(session.title, normalized) ||
        includesQuery(session.taskId, normalized) ||
        includesQuery(session.projectDir, normalized)
      ) {
        nextResults.push({
          id: `session:${session.id}`,
          group: 'Tasks',
          title: session.title,
          detail: [session.status, session.taskId].filter(Boolean).join(' · '),
          onSelect: () => onSelectSession(session.id)
        });
      }
    }

    for (const task of tasks) {
      if (includesQuery(task.userGoal, normalized) || includesQuery(task.taskId, normalized)) {
        nextResults.push({
          id: `task:${task.taskId}`,
          group: 'Tasks',
          title: task.userGoal,
          detail: [task.state, task.taskId].filter(Boolean).join(' · '),
          onSelect: () => {
            const matchingSession = sessions.find((session) => session.taskId === task.taskId);
            if (matchingSession) {
              onSelectSession(matchingSession.id);
            }
          }
        });
      }
    }

    for (const file of files) {
      nextResults.push({
        id: `file:${file.path}`,
        group: 'Files',
        title: file.path,
        detail: file.preview?.trim() || 'Workspace file',
        onSelect: () => onOpenFile(file.path)
      });
    }

    for (const command of commands) {
      if (includesQuery(command.name, normalized) || includesQuery(command.description, normalized)) {
        nextResults.push({
          id: `command:${command.name}`,
          group: 'Commands',
          title: command.name,
          detail: command.description || command.promptTemplate.slice(0, 80),
          onSelect: () => onInsertCommand(command.name)
        });
      }
    }

    for (const server of servers) {
      if (includesQuery(server.name, normalized) || includesQuery(server.id, normalized)) {
        nextResults.push({
          id: `server:${server.id}`,
          group: 'Plugins & Tools',
          title: server.name,
          detail: `MCP server · ${server.id}`,
          onSelect: () => undefined
        });
      }
    }

    for (const subAgent of subAgents) {
      if (includesQuery(subAgent.name, normalized) || includesQuery(subAgent.description, normalized)) {
        nextResults.push({
          id: `subagent:${subAgent.name}`,
          group: 'Plugins & Tools',
          title: subAgent.name,
          detail: subAgent.description || 'Sub-agent',
          onSelect: () => undefined
        });
      }
    }

    return nextResults;
  }, [commands, files, onInsertCommand, onOpenFile, onSelectProject, onSelectSession, projects, query, servers, sessions, subAgents, tasks]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const grouped = React.useMemo(() => {
    const order: SearchResult['group'][] = ['Projects', 'Files', 'Tasks', 'Commands', 'Plugins & Tools'];
    return order
      .map((group) => ({
        group,
        items: results.filter((result) => result.group === group)
      }))
      .filter((entry) => entry.items.length > 0);
  }, [results]);

  return (
    <section className="flex h-full min-w-0 flex-col bg-bobby-main px-8 py-8">
      <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col rounded-[28px] border bg-bobby-surface-card/70 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--bobby-border-muted)', background: 'var(--bobby-surface-elevated)' }}>
            <SearchIcon className="h-5 w-5 text-bobby-ink" />
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-bobby-faint">Global Search</div>
            <div className="text-[18px] font-semibold text-bobby-ink">Search across projects, files, tasks, commands, and tools</div>
          </div>
        </div>

        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              results[activeIndex]?.onSelect();
            }
          }}
          placeholder="Search everything"
          className="w-full rounded-2xl border bg-transparent px-4 py-3 text-[15px] text-bobby-ink outline-none placeholder:text-bobby-faint"
          style={{ borderColor: 'var(--bobby-border)' }}
        />

        <div className="mt-4 flex-1 overflow-y-auto">
          {!query.trim() ? (
            <div className="rounded-2xl border px-5 py-6 text-[14px] text-bobby-faint" style={{ borderColor: 'var(--bobby-border-muted)' }}>
              Start typing to search across projects, files, task sessions, commands, MCP servers, and sub-agents.
            </div>
          ) : grouped.length === 0 ? (
            <div className="rounded-2xl border px-5 py-6 text-[14px] text-bobby-faint" style={{ borderColor: 'var(--bobby-border-muted)' }}>
              No matching results.
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map((entry) => (
                <section key={entry.group}>
                  <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-bobby-faint">{entry.group}</div>
                  <div className="space-y-2">
                    {entry.items.map((item) => {
                      const flatIndex = results.findIndex((result) => result.id === item.id);
                      const active = flatIndex === activeIndex;
                      const icon = item.group === 'Files' ? FolderOpen : item.group === 'Commands' ? Command : item.group === 'Plugins & Tools' ? Puzzle : item.group === 'Tasks' ? Bot : FolderOpen;
                      const Icon = icon;
                      return (
                        <button
                          key={item.id}
                          data-testid={resultTestId(item.id)}
                          type="button"
                          onClick={item.onSelect}
                          className="flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition"
                          style={{
                            borderColor: active ? 'var(--bobby-accent)' : 'var(--bobby-border-muted)',
                            background: active ? 'var(--bobby-accent-soft)' : 'var(--bobby-surface-elevated)'
                          }}
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-bobby-faint" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-medium text-bobby-ink">{item.title}</div>
                            <div className="mt-1 truncate text-[12px] text-bobby-faint">{item.detail}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
