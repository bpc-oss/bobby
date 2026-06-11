import React from 'react';
import { FolderOpen, Plus, TerminalSquare } from 'lucide-react';
import type { ProjectMeta } from '../ipc/contract';

export function ProjectHome({
  projects,
  onOpenProject,
  onSelectProject
}: {
  projects: ProjectMeta[];
  onOpenProject: () => void;
  onSelectProject: (path: string) => void;
}) {
  return (
    <main className="flex h-full w-full flex-col bg-bobby-canvas">
      <header data-testid="project-home" className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--bobby-border-muted)' }}>
        <div>
          <h1 className="text-[15px] font-semibold text-bobby-ink">Bobby Workspace</h1>
          <p className="mt-0.5 text-[12px] text-bobby-muted">Open a project before starting agent sessions.</p>
        </div>
        <button type="button" onClick={onOpenProject} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-white">
          <Plus className="h-4 w-4" /> Open Project
        </button>
      </header>
      <section className="mx-auto flex w-full max-w-[900px] flex-1 flex-col px-6 py-8">
        <div className="mb-4 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-bobby-muted" />
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-bobby-faint">Recent Projects</h2>
        </div>
        {projects.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-8 text-center" style={{ borderColor: 'var(--bobby-border)' }}>
            <div>
              <TerminalSquare className="mx-auto mb-3 h-8 w-8 text-bobby-faint" />
              <p className="text-[13px] text-bobby-muted">No recent projects yet.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            {projects.map((project) => (
              <button
                key={project.path}
                type="button"
                data-testid={`project-home-project-${project.path.split(/[\\/]/).filter(Boolean).at(-1) ?? 'project'}`}
                onClick={() => onSelectProject(project.path)}
                className="flex min-w-0 items-center gap-3 rounded-lg border px-4 py-3 text-left hover:bg-bobby-hover"
                style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}
              >
                <FolderOpen className="h-4 w-4 shrink-0 text-bobby-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-bobby-ink">{project.name}</div>
                  <div className="truncate text-[12px] text-bobby-faint">{project.path}</div>
                </div>
                <span className="text-[11px] text-bobby-faint">{new Date(project.lastOpenedAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
