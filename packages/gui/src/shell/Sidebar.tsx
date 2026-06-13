import React from 'react';

import type { SessionMeta } from '../kernel/client';
import type { Lang } from '../lib/i18n';
import { getChatProjectName, resolveChatProject } from '../modes/chat-project-catalog';
import { useSessionStore } from '../store/session-store';
import type { AppMode } from '../store/ui-store';
import { useUiStore } from '../store/ui-store';
import { ModeSwitch } from './ModeSwitch';
import { resolveProject } from './project-catalog';
import { getFnItems } from './sidebar-config';

type DotKind = 'run' | 'gate' | 'ok' | 'err' | 'none';
type ProjectSessionGroup = {
  projectId: string;
  projectName: string;
  items: SessionMeta[];
  latestUpdatedAt: string;
};

const DRAFT_TITLES = new Set(['New Chat', 'New Session', '\u65b0\u5bf9\u8bdd', '\u65b0\u4f1a\u8bdd']);

function dotForStatus(status?: string): DotKind {
  if (status === 'running') return 'run';
  if (status === 'gate') return 'gate';
  if (status === 'done') return 'ok';
  if (status === 'failed') return 'err';
  return 'none';
}

function shouldShowSessionRow(session: SessionMeta, timelineLength: number, activeSessionId?: string): boolean {
  if (session.id === activeSessionId) return true;
  if (!DRAFT_TITLES.has(session.title) || session.status !== 'idle') return true;
  if (session.pinned || session.branch || session.project) return true;
  return timelineLength > 0;
}

function sortSessions(items: SessionMeta[]): SessionMeta[] {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function buildCodeProjectGroups(sessions: SessionMeta[]): ProjectSessionGroup[] {
  const grouped = new Map<string, ProjectSessionGroup>();

  sessions.forEach((session) => {
    if (session.pinned) return;

    const project = resolveProject(session.project);
    if (!project) return;

    const existing = grouped.get(project.id);
    if (existing) {
      existing.items.push(session);
      if (session.updatedAt > existing.latestUpdatedAt) {
        existing.latestUpdatedAt = session.updatedAt;
      }
      return;
    }

    grouped.set(project.id, {
      projectId: project.id,
      projectName: project.name,
      items: [session],
      latestUpdatedAt: session.updatedAt
    });
  });

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      items: sortSessions(group.items)
    }))
    .sort((a, b) => b.latestUpdatedAt.localeCompare(a.latestUpdatedAt));
}

function buildChatProjectGroups(sessions: SessionMeta[], lang: Lang): ProjectSessionGroup[] {
  const grouped = new Map<string, ProjectSessionGroup>();

  sessions.forEach((session) => {
    if (session.pinned) return;

    const projectRef = session.project?.trim();
    if (!projectRef) return;

    const project = resolveChatProject(projectRef);
    const projectId = project?.id ?? projectRef.toLowerCase();
    const projectName = getChatProjectName(projectRef, lang) ?? projectRef;
    const existing = grouped.get(projectId);

    if (existing) {
      existing.items.push(session);
      if (session.updatedAt > existing.latestUpdatedAt) {
        existing.latestUpdatedAt = session.updatedAt;
      }
      return;
    }

    grouped.set(projectId, {
      projectId,
      projectName,
      items: [session],
      latestUpdatedAt: session.updatedAt
    });
  });

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      items: sortSessions(group.items)
    }))
    .sort((a, b) => b.latestUpdatedAt.localeCompare(a.latestUpdatedAt));
}

function FnButtons({
  mode,
  lang,
  view,
  activeSessionId,
  onClick
}: {
  mode: AppMode;
  lang: Lang;
  view: ReturnType<typeof useUiStore.getState>['view'];
  activeSessionId?: string;
  onClick: (fnView: ReturnType<typeof getFnItems>[AppMode][number]['view']) => void;
}): JSX.Element {
  const items = getFnItems(lang)[mode];

  return (
    <div className="side-fn">
      {items.map((fn) => {
        const active = fn.view === 'session' ? view === 'session' && !activeSessionId : view === fn.view;

        return (
          <button key={fn.view} className={`fn-item ${active ? 'active' : ''}`} onClick={() => onClick(fn.view)}>
            <span className="ic">{fn.icon}</span>
            <span className="fn-label">{fn.label}</span>
            {fn.soon ? <span className="soon">{lang === 'zh' ? '\u5373\u5c06\u63a8\u51fa' : 'SOON'}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function SessionRow({
  session,
  active,
  onSelect,
  projectBadge
}: {
  session: SessionMeta;
  active: boolean;
  onSelect: (sessionId: string) => void;
  projectBadge?: string;
}): JSX.Element {
  return (
    <button className={`item ${active ? 'active' : ''}`} onClick={() => onSelect(session.id)}>
      <span className={`dot ${dotForStatus(session.status)}`} />
      <span className="t">{session.title}</span>
      <span className="item-meta">
        {projectBadge ? <span className="item-project">{projectBadge}</span> : null}
        <span className="time">{session.updatedAt ? session.updatedAt.slice(11, 16) : ''}</span>
      </span>
    </button>
  );
}

function SectionHeading({ label }: { label: string }): JSX.Element {
  return <div className="group-h">{label}</div>;
}

function ProjectTree({
  projectGroups,
  pinnedSessions,
  generalSessions,
  activeSessionId,
  lang,
  onSelect,
  pinnedProjectBadge,
  generalEmptyLabel,
  activeProjectId,
  onProjectToggle
}: {
  projectGroups: ProjectSessionGroup[];
  pinnedSessions: SessionMeta[];
  generalSessions: SessionMeta[];
  activeSessionId?: string;
  lang: Lang;
  onSelect: (sessionId: string) => void;
  pinnedProjectBadge?: (session: SessionMeta) => string | undefined;
  generalEmptyLabel: string;
  activeProjectId?: string;
  onProjectToggle?: (projectId: string) => void;
}): JSX.Element {
  const [openProjects, setOpenProjects] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(projectGroups.map((group) => [group.projectId, group.projectId === activeProjectId]))
  );

  React.useEffect(() => {
    if (!activeProjectId) return;
    setOpenProjects((state) => ({ ...state, [activeProjectId]: true }));
  }, [activeProjectId]);

  return (
    <>
      {pinnedSessions.length > 0 ? (
        <>
          <SectionHeading label={lang === 'zh' ? '\u7f6e\u9876' : 'Pinned'} />
          {pinnedSessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              active={activeSessionId === session.id}
              onSelect={onSelect}
              projectBadge={pinnedProjectBadge?.(session)}
            />
          ))}
        </>
      ) : null}

      <SectionHeading label={lang === 'zh' ? '\u9879\u76ee' : 'Projects'} />
      <div className="project-tree-list">
        {projectGroups.map((group) => {
          const expanded = openProjects[group.projectId] ?? false;

          return (
            <div key={group.projectId} className={`project-tree ${expanded ? 'expanded' : ''}`}>
              <button
                className="project-row"
                type="button"
                onClick={() => {
                  onProjectToggle?.(group.projectId);
                  setOpenProjects((state) => ({ ...state, [group.projectId]: !expanded }));
                }}
              >
                <span className="project-row-main">
                  <span className="project-row-title">
                    <span className="project-row-caret" aria-hidden>
                      {expanded ? '\u25be' : '\u25b8'}
                    </span>
                    <span>{group.projectName}</span>
                  </span>
                  <span className="project-row-count">{group.items.length}</span>
                </span>
              </button>

              {expanded ? (
                <div className="project-session-list">
                  {group.items.map((session) => (
                    <SessionRow key={session.id} session={session} active={activeSessionId === session.id} onSelect={onSelect} />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <SectionHeading label={lang === 'zh' ? '\u5168\u5c40\u901a\u7528' : 'General'} />
      {generalSessions.length > 0 ? (
        generalSessions.map((session) => (
          <SessionRow key={session.id} session={session} active={activeSessionId === session.id} onSelect={onSelect} />
        ))
      ) : (
        <div className="project-empty-note">{generalEmptyLabel}</div>
      )}
    </>
  );
}

function CodeProjectTree({
  sessions,
  activeSessionId,
  lang,
  onSelect
}: {
  sessions: SessionMeta[];
  activeSessionId?: string;
  lang: Lang;
  onSelect: (sessionId: string) => void;
}): JSX.Element {
  const currentProjectId = useUiStore((state) => state.currentProjectId);
  const setCurrentProjectId = useUiStore((state) => state.setCurrentProjectId);
  const projectGroups = React.useMemo(() => buildCodeProjectGroups(sessions), [sessions]);
  const activeProjectId = React.useMemo(() => {
    const activeSession = sessions.find((session) => session.id === activeSessionId);
    return resolveProject(activeSession?.project)?.id;
  }, [activeSessionId, sessions]);

  const pinnedSessions = React.useMemo(
    () => sortSessions(sessions.filter((session) => session.pinned)),
    [sessions]
  );
  const generalSessions = React.useMemo(
    () => sortSessions(sessions.filter((session) => !session.pinned && !session.project?.trim())),
    [sessions]
  );

  return (
    <ProjectTree
      projectGroups={projectGroups}
      pinnedSessions={pinnedSessions}
      generalSessions={generalSessions}
      activeSessionId={activeSessionId}
      activeProjectId={currentProjectId ?? activeProjectId}
      lang={lang}
      onSelect={onSelect}
      onProjectToggle={setCurrentProjectId}
      pinnedProjectBadge={(session) => resolveProject(session.project)?.name ?? session.project}
      generalEmptyLabel={
        lang === 'zh'
          ? '\u672a\u7ed1\u5b9a\u9879\u76ee\u6587\u4ef6\u5939\u7684 sessions \u4f1a\u663e\u793a\u5728\u8fd9\u91cc'
          : 'Sessions without a project folder appear here'
      }
    />
  );
}

function ChatProjectTree({
  sessions,
  activeSessionId,
  lang,
  onSelect
}: {
  sessions: SessionMeta[];
  activeSessionId?: string;
  lang: Lang;
  onSelect: (sessionId: string) => void;
}): JSX.Element {
  const projectGroups = React.useMemo(() => buildChatProjectGroups(sessions, lang), [lang, sessions]);
  const activeProjectId = React.useMemo(() => {
    const activeSession = sessions.find((session) => session.id === activeSessionId);
    const projectRef = activeSession?.project?.trim();
    if (!projectRef) return undefined;
    return resolveChatProject(projectRef)?.id ?? projectRef.toLowerCase();
  }, [activeSessionId, sessions]);

  const pinnedSessions = React.useMemo(
    () => sortSessions(sessions.filter((session) => session.pinned)),
    [sessions]
  );
  const generalSessions = React.useMemo(
    () => sortSessions(sessions.filter((session) => !session.pinned && !session.project?.trim())),
    [sessions]
  );

  return (
    <ProjectTree
      projectGroups={projectGroups}
      pinnedSessions={pinnedSessions}
      generalSessions={generalSessions}
      activeSessionId={activeSessionId}
      activeProjectId={activeProjectId}
      lang={lang}
      onSelect={onSelect}
      pinnedProjectBadge={(session) => getChatProjectName(session.project, lang)}
      generalEmptyLabel={
        lang === 'zh'
          ? '\u672a\u653e\u5165\u5185\u5bb9\u9879\u76ee\u7684 chats \u4f1a\u663e\u793a\u5728\u8fd9\u91cc'
          : 'Chats outside any content project appear here'
      }
    />
  );
}

export function Sidebar(): JSX.Element {
  const lang = useUiStore((state) => state.lang);
  const mode = useUiStore((state) => state.mode);
  const view = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);
  const setCurrentProjectId = useUiStore((state) => state.setCurrentProjectId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const clearActiveSession = useSessionStore((state) => state.clearActiveSession);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const sessions = useSessionStore((state) => state.sessions);
  const timelines = useSessionStore((state) => state.timelines);

  const codeSessions = React.useMemo(
    () =>
      sortSessions(
        Object.values(sessions)
          .filter((session) => session.mode === 'code')
          .filter((session) => shouldShowSessionRow(session, timelines[session.id]?.length ?? 0, activeSessionId))
      ),
    [activeSessionId, sessions, timelines]
  );

  const chatSessions = React.useMemo(
    () =>
      sortSessions(
        Object.values(sessions)
          .filter((session) => session.mode === 'chat')
          .filter((session) => shouldShowSessionRow(session, timelines[session.id]?.length ?? 0, activeSessionId))
      ),
    [activeSessionId, sessions, timelines]
  );

  const listView = mode === 'code' && view === 'projects' ? 'session' : view;

  const openSession = (sessionId: string): void => {
    const session = sessions[sessionId];
    if (mode === 'code') {
      if (session?.project) {
        setCurrentProjectId(resolveProject(session.project)?.id);
      } else {
        setCurrentProjectId(undefined);
      }
    }
    setActiveSession(sessionId);
    setView('session');
  };

  const handleFnClick = (fnView: ReturnType<typeof getFnItems>[AppMode][number]['view']): void => {
    if (fnView === 'session') {
      clearActiveSession();
      setView('session');
      return;
    }

    setView(fnView);
  };

  return (
    <aside className="side side-shell">
      <ModeSwitch codeBadge={1} />
      <FnButtons mode={mode} lang={lang} view={listView} activeSessionId={activeSessionId} onClick={handleFnClick} />
      <div className="side-sep" />
      <div className="side-list side-list-shell">
        {mode === 'code' ? (
          <CodeProjectTree sessions={codeSessions} activeSessionId={activeSessionId} lang={lang} onSelect={openSession} />
        ) : (
          <ChatProjectTree sessions={chatSessions} activeSessionId={activeSessionId} lang={lang} onSelect={openSession} />
        )}
      </div>
      <div className="side-bottom">
        <button className={`sb-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
          <span aria-hidden>{'\u2699'}</span>
          <span>{lang === 'zh' ? '\u8bbe\u7f6e' : 'Settings'}</span>
        </button>
        <button className="sb-btn acct" aria-label={lang === 'zh' ? '\u8d26\u6237' : 'Account'}>
          <span className="avatar">B</span>
        </button>
      </div>
    </aside>
  );
}
