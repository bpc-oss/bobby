import React from 'react';

export function TitleBar({ projectName }: { projectName: string }): JSX.Element {
  return (
    <div className="titlebar">
      <span className="brand">
        <i aria-hidden /> BOBBY
      </span>
      <button className="pill">⌕ {projectName} ▾</button>
      <button className="pill palette">
        ⌕ 搜索或执行命令…<kbd>Ctrl K</kbd>
      </button>
      <button className="icon-btn" aria-label="通知">🔂</button>
    </div>
  );
}
