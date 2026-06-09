import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KernelEvent } from '@bobby/shared';

export type AssertionSet = {
  contains?: string[];
  notContains?: string[];
  orderedLines?: string[];
  notExist?: string[];
  exitCode?: number;
};

type HeadlessFixture = {
  id: string;
  description: string;
  kind: 'headless';
  input: string;
  events: KernelEvent[];
  assertions: AssertionSet;
};

type RunFixture = {
  id: string;
  description: string;
  kind: 'run';
  argv: string[];
  environment: {
    homeMode: 'missing' | 'ready';
    hasKey?: boolean;
    hasCapabilities?: boolean;
  };
  assertions: AssertionSet;
};

type SlashFixture = {
  id: string;
  description: string;
  kind: 'slash';
  handler?: 'host-empty';
  command: {
    name: 'cost' | 'agents' | 'undo' | 'resume';
    args: string[];
    raw?: string;
  };
  assertions: AssertionSet;
};

export type InteractionFixture = HeadlessFixture | RunFixture | SlashFixture;

export function loadInteractionFixtures(): InteractionFixture[] {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'interaction');
  const fixtures = readdirSync(fixtureDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(fixtureDir, file), 'utf8')) as InteractionFixture);

  return fixtures;
}

export function assertOrderedContainments(output: string, orderedLines: string[]): void {
  let cursor = 0;

  for (const expectedLine of orderedLines) {
    const foundAt = output.indexOf(expectedLine, cursor);
    if (foundAt < 0) {
      throw new Error(`Expected ordered line not found: ${expectedLine}`);
    }
    cursor = foundAt + expectedLine.length;
  }
}
