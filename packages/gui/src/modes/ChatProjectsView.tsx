import React from 'react';

import type { SessionMeta } from '../kernel/client';
import { useSessionStore } from '../store/session-store';
import { useUiStore } from '../store/ui-store';
import { CHAT_PROJECTS, resolveChatProject } from './chat-project-catalog';

function countProjectThreads(projectId: string, sessions: SessionMeta[]): number {
  return sessions.filter((session) => {
    if (session.mode !== 'chat') return false;
    return resolveChatProject(session.project)?.id === projectId;
  }).length;
}

export function ChatProjectsView(): JSX.Element {
  const lang = useUiStore((state) => state.lang);
  const sessionsById = useSessionStore((state) => state.sessions);
  const sessions = React.useMemo(() => Object.values(sessionsById), [sessionsById]);

  return (
    <div className="chat-projects-view">
      <div className="chat-projects-hero">
        <span className="chat-projects-kicker">{lang === 'zh' ? '聊天项目' : 'Chat projects'}</span>
        <h2>{lang === 'zh' ? '内容项目' : 'Content projects'}</h2>
        <p>
          {lang === 'zh'
            ? '这里的项目不是本地工作目录，而是围绕写作、研究、课程和长期主题搭建的上下文集合。一个项目下面可以继续开很多条 chat 线程。'
            : 'Projects here are not local workspaces. They are content containers for writing, research, course work, and other long-running themes, each with many chat threads underneath.'}
        </p>
      </div>

      <div className="chat-projects-toolbar">
        <button type="button" className="chat-projects-primary">
          {lang === 'zh' ? '+ 新建项目' : '+ New project'}
        </button>
        <span className="chat-projects-note">
          {lang === 'zh' ? '项目内共享说明、资料与线程历史' : 'Shared instructions, materials, and thread history per project'}
        </span>
      </div>

      <div className="chat-projects-grid">
        {CHAT_PROJECTS.map((project) => {
          const threadCount = countProjectThreads(project.id, sessions);
          return (
            <article key={project.id} className="chat-project-card">
              <div className="chat-project-card-top">
                <span className="chat-project-chip">{lang === 'zh' ? '内容项目' : 'Content project'}</span>
                <span className="chat-project-count">
                  {lang === 'zh' ? `${threadCount} 条线程` : `${threadCount} threads`}
                </span>
              </div>
              <h3>{lang === 'zh' ? project.nameZh : project.nameEn}</h3>
              <p>{lang === 'zh' ? project.summaryZh : project.summaryEn}</p>
              <div className="chat-project-meta">
                <span>{lang === 'zh' ? project.goalZh : project.goalEn}</span>
                <span>{lang === 'zh' ? `${project.sourceCount} 份资料` : `${project.sourceCount} sources`}</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
