import React from 'react';

import { findProjectById, PROJECT_OPTIONS } from '../shell/project-catalog';
import type { AppMode } from '../store/ui-store';
import { useUiStore } from '../store/ui-store';

interface ComposerProps {
  onSubmit: (input: string) => void;
  mode: AppMode;
  disabled?: boolean;
  showWorkspaceSelector?: boolean;
}

export function Composer({
  onSubmit,
  mode,
  disabled = false,
  showWorkspaceSelector = true
}: ComposerProps): JSX.Element {
  const [input, setInput] = React.useState('');
  const lang = useUiStore((state) => state.lang);
  const currentProjectId = useUiStore((state) => state.currentProjectId);
  const setCurrentProjectId = useUiStore((state) => state.setCurrentProjectId);
  const currentProject = findProjectById(currentProjectId);
  const isCode = mode === 'code';

  const submit = (): void => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setInput('');
  };

  return (
    <div className="composer">
      <textarea
        className="input"
        placeholder={
          lang === 'zh'
            ? '询问或下达任务... @文件、/命令、粘贴图片'
            : 'Ask or assign work... @files, /commands, paste images'
        }
        value={input}
        disabled={disabled}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="tools">
        <span className="chip mono">@</span>
        <span className="chip mono">/</span>
        <span className="chip">⊕</span>
        <span className="chip model">{lang === 'zh' ? '模型 · Flash ▾' : 'Model · Flash ▾'}</span>
        <span className="chip">{lang === 'zh' ? '权限 · 询问 ▾' : 'Permissions · Ask ▾'}</span>
        <span className="chip">{lang === 'zh' ? '思考 · 中 ▾' : 'Reasoning · Medium ▾'}</span>
        <button className="send" type="button" onClick={submit} disabled={disabled}>
          {lang === 'zh' ? '发送 ↗' : 'Send ↗'}
        </button>
      </div>
      {isCode && showWorkspaceSelector ? (
        <div className="composer-context">
          <label className="composer-project" htmlFor="composer-project-select">
            <span className="composer-context-label">{lang === 'zh' ? '工作区' : 'Workspace'}</span>
            <select
              id="composer-project-select"
              className="composer-select"
              value={currentProjectId ?? ''}
              onChange={(event) => setCurrentProjectId(event.target.value || undefined)}
            >
              <option value="">{lang === 'zh' ? '全局通用（系统根目录）' : 'Global session (system root)'}</option>
              {PROJECT_OPTIONS.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <div className="composer-context-meta">
            {currentProject ? (
              <>
                <span className="context-path">{currentProject.path}</span>
                <span className="context-branch">
                  {lang === 'zh' ? '该项目下可创建多个 sessions' : 'Multiple sessions can live under this project'}
                </span>
              </>
            ) : (
              <>
                <span className="context-path">
                  {lang === 'zh' ? '当前 session 不绑定项目文件夹。' : 'This session is not bound to a project folder.'}
                </span>
                <span className="context-branch">
                  {lang === 'zh' ? '它会归入全局通用会话。' : 'It will be tracked as a global session.'}
                </span>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
