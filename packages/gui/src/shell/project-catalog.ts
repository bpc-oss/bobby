export interface ProjectOption {
  id: string;
  name: string;
  path: string;
}

export const PROJECT_OPTIONS: ProjectOption[] = [
  { id: 'bobby', name: 'Bobby', path: 'E:/ai-files/Bobby' },
  { id: 'app-develop-team', name: 'APP develop team', path: 'E:/ai-files/APP develop team' },
  { id: 'freqtrade', name: 'freqtrade', path: 'E:/ai-files/freqtrade' },
  { id: 'paper-tools', name: 'Paper tools', path: 'E:/ai-files/paper-tools' }
];

function normalizeProjectRef(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

export function findProjectById(projectId?: string): ProjectOption | undefined {
  const normalized = normalizeProjectRef(projectId);
  if (!normalized) return undefined;
  return PROJECT_OPTIONS.find((project) => project.id === normalized);
}

export function findProjectByName(projectName?: string): ProjectOption | undefined {
  const normalized = normalizeProjectRef(projectName);
  if (!normalized) return undefined;
  return PROJECT_OPTIONS.find((project) => normalizeProjectRef(project.name) === normalized);
}

export function resolveProject(projectRef?: string): ProjectOption | undefined {
  const normalized = normalizeProjectRef(projectRef);
  if (!normalized) return undefined;
  return PROJECT_OPTIONS.find(
    (project) =>
      normalizeProjectRef(project.id) === normalized ||
      normalizeProjectRef(project.name) === normalized ||
      normalizeProjectRef(project.path) === normalized
  );
}
