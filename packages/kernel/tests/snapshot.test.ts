import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

import { afterEach, beforeEach, expect, it } from 'vitest';

import { createSnapshot, listSnapshots, restoreSnapshot } from '../src/hands/snapshot';

const createdWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-kernel-snapshot-'));
  createdWorkspaces.push(workspaceRoot);
  return workspaceRoot;
}

function writeSkipCaseWorkspace(workspaceRoot: string): void {
  writeFileSync(join(workspaceRoot, 'src.ts'), 'export const keep = true;', 'utf8');
  mkdirSync(join(workspaceRoot, 'node_modules'), { recursive: true });
  writeFileSync(join(workspaceRoot, 'node_modules', 'cache.txt'), 'should-ignore', 'utf8');
  mkdirSync(join(workspaceRoot, '.git'), { recursive: true });
  writeFileSync(join(workspaceRoot, '.git', 'config'), 'ignore', 'utf8');
  mkdirSync(join(workspaceRoot, '.bobby'), { recursive: true });
  writeFileSync(join(workspaceRoot, '.bobby', 'settings.json'), 'ignore', 'utf8');
  writeFileSync(join(workspaceRoot, 'binary.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
}

function assertSnapshotExclusions(workspaceRoot: string, snapshotId: string): void {
  const snapshotRoot = snapshotPath(workspaceRoot, snapshotId);
  expect(() => readFileSync(join(snapshotRoot, 'node_modules', 'cache.txt'), 'utf8')).toThrow();
  expect(() => readFileSync(join(snapshotRoot, '.git', 'config'), 'utf8')).toThrow();
  expect(() => readFileSync(join(snapshotRoot, '.bobby', 'settings.json'), 'utf8')).toThrow();
  expect(readFileSync(join(snapshotRoot, 'src.ts'), 'utf8')).toBe('export const keep = true;');
  expect(() => readFileSync(join(snapshotRoot, 'binary.png'), 'utf8')).toThrow();
}

function assertSkippedManifestPaths(snapshot: { skipped: Array<{ path: string; reason: string }> }): void {
  const skippedPaths = snapshot.skipped.map((entry) => entry.path);
  expect(skippedPaths.some((path) => path === 'node_modules')).toBe(true);
  expect(skippedPaths.some((path) => path === '.git')).toBe(true);
  expect(skippedPaths.some((path) => path === '.bobby')).toBe(true);
  expect(skippedPaths.every((path) => !path.includes('..'))).toBe(true);
  expect(snapshot.skipped.some((entry) => entry.reason === 'binary-or-non-text')).toBe(true);
}

beforeEach(() => {
  createdWorkspaces.length = 0;
});

afterEach(() => {
  for (const workspaceRoot of createdWorkspaces) {
    rmSync(workspaceRoot, { force: true, recursive: true });
  }
});

function snapshotPath(workspaceRoot: string, snapshotId: string): string {
  return join(workspaceRoot, '.bobby', 'snapshots', snapshotId);
}

it('snapshot -> modify -> restore gets original text-like file content back', async () => {
  const workspaceRoot = createWorkspace();
  const sourcePath = join(workspaceRoot, 'hello.txt');
  writeFileSync(sourcePath, 'before', 'utf8');

  const snapshot = await createSnapshot(workspaceRoot);
  writeFileSync(sourcePath, 'after', 'utf8');

  await restoreSnapshot(workspaceRoot, snapshot.id);

  expect(readFileSync(sourcePath, 'utf8')).toBe('before');
});

it('snapshot skips node_modules/.git/.bobby and records skipped files', async () => {
  const workspaceRoot = createWorkspace();
  writeSkipCaseWorkspace(workspaceRoot);

  const snapshot = await createSnapshot(workspaceRoot, { id: 'skip-case' });
  assertSnapshotExclusions(workspaceRoot, snapshot.id);
  assertSkippedManifestPaths(snapshot);
});

it('listSnapshots reads manifests from .bobby/snapshots', async () => {
  const workspaceRoot = createWorkspace();
  writeFileSync(join(workspaceRoot, 'notes.md'), '# note', 'utf8');

  const first = await createSnapshot(workspaceRoot, { id: 'snapshot-a' });
  const second = await createSnapshot(workspaceRoot, { id: 'snapshot-b' });
  const listed = await listSnapshots(workspaceRoot);

  expect(listed.map((entry) => entry.id)).toEqual(expect.arrayContaining([first.id, second.id]));
  expect(listed.some((entry) => entry.id === 'snapshot-a')).toBe(true);
  expect(listed.some((entry) => entry.id === 'snapshot-b')).toBe(true);
  const snapshotB = listed.find((entry) => entry.id === 'snapshot-b');
  expect(snapshotB).toBeDefined();
  if (snapshotB) {
    expect(snapshotB.copied).toEqual(
      expect.arrayContaining([
        { path: 'notes.md', bytes: expect.any(Number) }
      ])
    );
  }
});

it('snapshot metadata includes task and step ids when provided', async () => {
  const workspaceRoot = createWorkspace();
  writeFileSync(join(workspaceRoot, 'meta.txt'), 'meta', 'utf8');

  const snapshot = await createSnapshot(workspaceRoot, { id: 'snapshot-meta', taskId: 'task-1', stepId: 'step-1' });
  const listed = await listSnapshots(workspaceRoot);
  const entry = listed.find((item) => item.id === snapshot.id);

  expect(snapshot.taskId).toBe('task-1');
  expect(snapshot.stepId).toBe('step-1');
  expect(entry?.taskId).toBe('task-1');
  expect(entry?.stepId).toBe('step-1');
});

it('restore throws on workspace path traversal snapshot id and fs-tool workspace snapshot entries', async () => {
  const workspaceRoot = createWorkspace();
  writeFileSync(join(workspaceRoot, 'safe.txt'), 'safe', 'utf8');

  await createSnapshot(workspaceRoot, { id: 'safe-id' });
  const manifestFile = join(snapshotPath(workspaceRoot, 'safe-id'), 'manifest.json');
  const parsed = JSON.parse(readFileSync(manifestFile, 'utf8'));
  parsed.copied.push({
    path: `..${sep}escape.txt`,
    bytes: 2
  });
  writeFileSync(manifestFile, JSON.stringify(parsed), 'utf8');

  await expect(restoreSnapshot(workspaceRoot, '../outside')).rejects.toThrow(/snapshot id/i);
  await expect(restoreSnapshot(workspaceRoot, 'safe-id')).rejects.toThrow(/invalid snapshot entry path/i);
});
