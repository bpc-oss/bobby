import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { Workspace } from './workspace';

const SNAPSHOT_ROOT = '.bobby/snapshots';
const MANIFEST_FILE_NAME = 'manifest.json';

export interface SnapshotEntry {
  path: string;
  bytes: number;
}

export interface SkippedSnapshotEntry {
  path: string;
  reason: 'binary-or-non-text' | 'excluded';
}

export interface SnapshotManifest {
  id: string;
  createdAt: string;
  copied: SnapshotEntry[];
  skipped: SkippedSnapshotEntry[];
  taskId?: string;
  stepId?: string;
}

export interface SnapshotOptions {
  id?: string;
  taskId?: string;
  stepId?: string;
}

export interface SnapshotListEntry extends SnapshotManifest {
  snapshotDir: string;
}

const DEFAULT_TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.md',
  '.mdx',
  '.txt',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.html',
  '.htm',
  '.xml'
]);

const DEFAULT_TEXT_FILENAMES = new Set(['readme.md', 'license', 'dockerfile', 'makefile', '.gitignore', '.npmignore']);

const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.bobby']);

function isAllowedSnapshotId(id: string): boolean {
  return Boolean(id) && !id.includes('..') && !id.includes(sep) && !id.includes('/') && !id.includes('\\') && !isAbsolute(id);
}

function normalizeToRelPosix(p: string): string {
  return p.split('\\').join('/');
}

function normalizeToPlatform(p: string): string {
  return p.split('/').join(sep);
}

function isTextLike(name: string): boolean {
  const extension = extname(name).toLowerCase();
  if (DEFAULT_TEXT_EXTENSIONS.has(extension)) {
    return true;
  }

  const fileName = name.toLowerCase();
  if (DEFAULT_TEXT_FILENAMES.has(fileName)) {
    return true;
  }

  return false;
}

function isSafeRelativePath(candidate: string): boolean {
  if (!candidate || candidate.includes('\u0000') || isAbsolute(candidate)) {
    return false;
  }

  if (candidate.startsWith('..') || candidate.includes('/..') || candidate.includes('\\..')) {
    return false;
  }

  if (candidate.includes('//') || candidate.includes('\\\\')) {
    return false;
  }

  const segments = candidate.split(/[/\\]+/);
  return segments.every((segment) => segment !== '' && segment !== '.');
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function collectTextEntries(
  workspaceRoot: string,
  snapshotRoot: string,
  currentPath: string,
  manifest: SnapshotManifest
): Promise<void> {
  const directoryEntries = await readdir(currentPath, { withFileTypes: true });
  for (const entry of directoryEntries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        manifest.skipped.push({
          path: normalizeToRelPosix(relative(workspaceRoot, join(currentPath, entry.name))),
          reason: 'excluded'
        });
        continue;
      }

      await collectTextEntries(workspaceRoot, snapshotRoot, join(currentPath, entry.name), manifest);
      continue;
    }

    if (!entry.isFile()) {
      manifest.skipped.push({
        path: normalizeToRelPosix(relative(workspaceRoot, join(currentPath, entry.name))),
        reason: 'excluded'
      });
      continue;
    }

    const absolutePath = resolve(currentPath, entry.name);
    const relativePath = relative(workspaceRoot, absolutePath);
    if (!isTextLike(entry.name)) {
      manifest.skipped.push({
        path: normalizeToRelPosix(relativePath),
        reason: 'binary-or-non-text'
      });
      continue;
    }

    const fileContent = await readFile(absolutePath, 'utf8');
    const bytes = Buffer.byteLength(fileContent, 'utf8');
    const normalizedRelativePath = normalizeToRelPosix(relativePath);
    const destination = join(snapshotRoot, normalizeToPlatform(normalizedRelativePath));
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, fileContent, 'utf8');
    manifest.copied.push({ path: normalizedRelativePath, bytes });
  }
}

export async function createSnapshot(workspaceRoot: string, options: SnapshotOptions = {}): Promise<SnapshotManifest> {
  const workspace = new Workspace(workspaceRoot);
  const absoluteRoot = workspace.resolveInside('.');
  const id = options.id ?? randomUUID();
  if (!isAllowedSnapshotId(id)) {
    throw new Error(`Invalid snapshot id: ${id}`);
  }

  const snapshotDir = resolve(absoluteRoot, SNAPSHOT_ROOT, id);
  const manifestPath = resolve(snapshotDir, MANIFEST_FILE_NAME);
  const createdAt = new Date().toISOString();

  const manifest: SnapshotManifest = {
    id,
    createdAt,
    copied: [],
    skipped: [],
    ...(options.taskId ? { taskId: options.taskId } : {}),
    ...(options.stepId ? { stepId: options.stepId } : {})
  };

  await rm(snapshotDir, { recursive: true, force: true });
  await mkdir(snapshotDir, { recursive: true });

  await collectTextEntries(absoluteRoot, snapshotDir, absoluteRoot, manifest);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

async function readManifest(snapshotPath: string): Promise<SnapshotManifest> {
  const rawManifest = await readFile(resolve(snapshotPath, MANIFEST_FILE_NAME), 'utf8');
  return JSON.parse(rawManifest) as SnapshotManifest;
}

function manifestPathSet(manifest: SnapshotManifest): Set<string> {
  return new Set([
    ...manifest.copied.map((entry) => entry.path),
    ...manifest.skipped.map((entry) => entry.path)
  ]);
}

async function removeEntriesNotInSnapshot(
  workspaceRoot: string,
  currentPath: string,
  preservedPaths: Set<string>
): Promise<void> {
  const entries = await readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) {
      continue;
    }

    const absolutePath = resolve(currentPath, entry.name);
    const relativePath = normalizeToRelPosix(relative(workspaceRoot, absolutePath));
    if (!isSafeRelativePath(relativePath)) {
      throw new Error(`Invalid workspace entry path during restore: ${relativePath}`);
    }

    if (entry.isDirectory()) {
      await removeEntriesNotInSnapshot(workspaceRoot, absolutePath, preservedPaths);
      const remaining = await readdir(absolutePath);
      if (remaining.length === 0 && !preservedPaths.has(relativePath)) {
        await rm(absolutePath, { recursive: true, force: true });
      }
      continue;
    }

    if (!preservedPaths.has(relativePath)) {
      await rm(absolutePath, { force: true });
    }
  }
}

export async function listSnapshots(workspaceRoot: string): Promise<SnapshotListEntry[]> {
  const workspace = new Workspace(workspaceRoot);
  const snapshotRoot = workspace.resolveInside(SNAPSHOT_ROOT);
  if (!(await fileExists(snapshotRoot))) {
    return [];
  }

  const entries = await readdir(snapshotRoot, { withFileTypes: true });
  const result: SnapshotListEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const snapshotPath = resolve(snapshotRoot, entry.name);
    if (!isAllowedSnapshotId(entry.name)) {
      continue;
    }

    try {
      const manifest = await readManifest(snapshotPath);
      result.push({ ...manifest, snapshotDir: snapshotPath });
    } catch {
      continue;
    }
  }

  result.sort((left, right) => (left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0));
  return result;
}

export async function restoreSnapshot(workspaceRoot: string, snapshotId: string): Promise<void> {
  if (!isAllowedSnapshotId(snapshotId)) {
    throw new Error(`Invalid snapshot id: ${snapshotId}`);
  }

  const workspace = new Workspace(workspaceRoot);
  const absoluteRoot = workspace.resolveInside('.');
  const snapshotDir = resolve(absoluteRoot, SNAPSHOT_ROOT, snapshotId);
  const manifest = await readManifest(snapshotDir);
  const preservedPaths = manifestPathSet(manifest);

  await removeEntriesNotInSnapshot(absoluteRoot, absoluteRoot, preservedPaths);

  for (const entry of manifest.copied) {
    if (!isSafeRelativePath(entry.path)) {
      throw new Error(`Invalid snapshot entry path: ${entry.path}`);
    }

    const targetPath = workspace.resolveInside(entry.path);
    const absoluteSource = resolve(snapshotDir, entry.path);

    if (!isInside(snapshotDir, absoluteSource)) {
      throw new Error(`Snapshot path escapes snapshot root: ${entry.path}`);
    }

    const content = await readFile(absoluteSource, 'utf8');
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, 'utf8');
  }
}
