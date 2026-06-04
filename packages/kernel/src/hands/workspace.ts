import { isAbsolute, relative, resolve, sep } from 'node:path';

export class Workspace {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  resolveInside(candidate: string): string {
    const absolute = isAbsolute(candidate) ? resolve(candidate) : resolve(this.root, candidate);
    const rel = relative(this.root, absolute);

    if (rel === '' || rel === '.') {
      return absolute;
    }

    if (isAbsolute(rel) || rel.startsWith(`..${sep}`) || rel === '..') {
      throw new Error(`Path outside workspace: ${candidate}`);
    }

    return absolute;
  }
}
