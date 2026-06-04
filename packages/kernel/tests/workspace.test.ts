import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Workspace } from '../src/hands/workspace';

describe('Workspace', () => {
  it('resolves an in-workspace relative path to absolute', () => {
    const root = resolve('workspace-root');
    const workspace = new Workspace(root);
    expect(workspace.resolveInside('file.txt')).toBe(resolve(root, 'file.txt'));
  });

  it('resolves a path that normalizes back inside workspace', () => {
    const root = resolve('workspace-root');
    const workspace = new Workspace(root);
    expect(workspace.resolveInside('nested/../file.txt')).toBe(resolve(root, 'file.txt'));
  });

  it('rejects relative path traversal that escapes workspace', () => {
    const root = resolve('workspace-root');
    const workspace = new Workspace(root);
    expect(() => workspace.resolveInside('../outside.txt')).toThrow(/outside workspace/i);
  });

  it('rejects absolute path outside workspace', () => {
    const root = resolve('workspace-root');
    const workspace = new Workspace(root);
    const outsidePath = resolve(root, '..', 'outside.txt');
    expect(() => workspace.resolveInside(outsidePath)).toThrow(/outside workspace/i);
  });
});
