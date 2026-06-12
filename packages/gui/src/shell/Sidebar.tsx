import React from 'react';

import type { AppMode } from '../store/ui-store';
import type { SessionMeta } from '../kernel/client';
import { getKernelClient } from '../kernel';
import { useSessionStore } from '../store/session-store';
import { useUiStore } from '../store/ui-store';
import { ModeSwitch } from './ModeSwitch';
import { FN_ITEMS } from './sidebar-config';

type DotKind = 'run' | 'gate' | 'ok' | 'err' | 'none';
type SessionGroup = { heading: string; items: SessionMeta[] };

function dotForStatus(status?: string): DotKind {
  if (status === 'running') return 'run';
  if (status === 'gate') return 'gate';
  if (status === 'done') return 'ok';
  if (status === 'failed') return 'err';
  return 'none';
}

function groupSessions(sessions: Record<string, SessionMeta>, mode: AppMode): SessionGroup[] {
  const rows = Object.values(sessions)
    .filter((session) => session.mode === mode)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

  const grouped = rows
    .filter((session) => !session.pinned)
    .reduce<Record<string, SessionMeta[]>>((acc, session) => {
      const key = session.project ?? '未分组';
      acc[key] ??= [];
      acc[key].push(session);
      return acc;
    }, {});

  return [
    { heading: 'PINNED', items: rows.filter((session) => session.pinned) },
    ...Object.entries(grouped).map(([heading, items]) => ({ heading: heading.toUpperCase(), items }))
  ].filter((group) => group.items.length > 0);
}

function FnButtons({
  mode,
  view,
  onClick
}: {
  mode: AppMode;
  view: ReturnType<typeof useUiStore.getState>['view'];
  onClick: (fnView: (typeof FN_ITEMS)[AppMode][number]['view']) => void;
}): JSX.Element {
  return (
    <div className="side-fn">
      {FN_ITEMS[mode].map((fn) => (
        <button
          key={fn.view}
          className={`fn-item ${view === fn.view ? 'active' : ''}`}
          onClick={() => onClick(fn.view)}
        >
          <span className="ic">{fn.icon}</span>
          {fn.label}
          {fn.soon && <span className="soon">SOON</span>}
        </button>
      ))}
    </div>
  );
}

function SessionGroups({
  groups,
  onSelect
}: {
  groups: SessionGroup[];
  onSelect: (sessionId: string) => void;
}): JSX.Element {
  return (
    <>
      {groups.map((group) => (
        <React.Fragment key={group.heading}>
          <div className="group-h">{group.heading}</div>
          {group.items.map((item) => (
            <button className="item" key={item.id} onClick={() => onSelect(item.id)}>
              <span className={`dot ${dotForStatus(item.status)}`} />
              <span className="t">{item.title}</span>
              <span className="time">{item.updatedAt ? item.updatedAt.slice(11, 16) : ''}</span>
            </button>
          ))}
        </React.Fragment>
      ))}
    </>
  );
}

export function Sidebar(): JSX.Element {
  const mode = useUiStore((state) => state.mode);
  const view = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const sessions = useSessionStore((state) => state.sessions);
  const groups = groupSessions(sessions, mode);

  const openSession = (sessionId: string): void => {
    setActiveSession(sessionId);
    setView('session');
  };

  const handleFnClick = (fnView: (typeof FN_ITEMS)[AppMode][number]['view']): void => {
    if (fnView === 'session') {
      void getKernelClient()
        .createSession(mode)
        .then((created) => openSession(created.id));
      return;
    }

    setView(fnView);
  };

  return (
    <aside className="side">
      <ModeSwitch codeBadge={1} />
      <FnButtons mode={mode} view={view} onClick={handleFnClick} />
      <div className="side-sep" />
      <div className="side-list">
        <SessionGroups groups={groups} onSelect={openSession} />
      </div>
      <div className="side-bottom">
        <button
          className={`sb-btn ${view === 'settings' ? 'active' : ''}`}
          onClick={() => setView('settings')}
        >
          <span aria-hidden>⚙</span>
          <span>Settings</span>
        </button>
        <button className="sb-btn acct">
          <span className="avatar">B</span>
        </button>
      </div>
    </aside>
  );
}
