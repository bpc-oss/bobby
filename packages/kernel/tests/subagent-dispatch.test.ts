import { describe, expect, it, vi } from 'vitest';

import { join } from 'node:path';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import { loadSubAgents } from '../src/subagent/agent-loader';
import { applySubAgentProposal, dispatchSubAgent } from '../src/subagent/dispatch';

function runGit(root: string, args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8'
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(result.stderr?.toString() ?? `git ${args.join(' ')} failed`);
  }

  return result.stdout?.toString() ?? '';
}

async function buildRepoWithCommit(): Promise<string> {
  const repoRoot = mkdtempSync(join(tmpdir(), 'bobby-subagent-dispatch-'));
  mkdirSync(join(repoRoot, '.bobby', 'agents'), { recursive: true });

  writeFileSync(join(repoRoot, 'target.txt'), 'before', 'utf8');
  runGit(repoRoot, ['init', '-q']);
  runGit(repoRoot, ['add', 'target.txt']);
  runGit(repoRoot, ['commit', '-m', 'base', '-q']);
  return repoRoot;
}

function withIsolatedRunnerTest(repoRoot: string): Promise<string> {
  writeFileSync(
    join(repoRoot, '.bobby', 'agents', 'agent.md'),
    ['---', 'name: writer', 'description: modifies target', '---', 'noop'].join('\n')
  );
  const [agent] = loadSubAgents(repoRoot).agents;
  const proposalRoot = join(repoRoot, '.bobby', 'proposals');

  return dispatchSubAgent(agent, 'make target say after', {
    repoRoot,
    proposalRoot,
    runInWorktree: async (_agent, _task, worktreePath) => {
      writeFileSync(join(worktreePath, 'target.txt'), 'after', 'utf8');
    }
  }).then((result) => result.proposalPath);
}

async function withRepo<T>(callback: (repoRoot: string) => Promise<T> | T): Promise<T> {
  const repoRoot = await buildRepoWithCommit();
  try {
    return await callback(repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

async function verifyDispatchIsolation(repoRoot: string): Promise<void> {
  const proposalPath = await withIsolatedRunnerTest(repoRoot);
  const proposal = readFileSync(proposalPath, 'utf8');
  expect(proposal).toContain('diff --git a/target.txt b/target.txt');
  expect(readFileSync(join(repoRoot, 'target.txt'), 'utf8')).toBe('before');
}

async function verifyMergeGateRules(repoRoot: string): Promise<void> {
  const runner = vi.fn(async (_agent, _task, worktreePath) => {
    writeFileSync(join(worktreePath, 'target.txt'), 'after', 'utf8');
  });

  const result = await dispatchSubAgent(
    {
      name: 'writer',
      description: 'inline',
      tools: ['write'],
      triggers: [],
      systemPrompt: 'x',
      sourcePath: join(repoRoot, '.bobby', 'agents', 'agent.md')
    },
    'write file',
    {
      repoRoot,
      runInWorktree: runner
    }
  );

  expect(readFileSync(join(repoRoot, 'target.txt'), 'utf8')).toBe('before');

  expect(() =>
    applySubAgentProposal(
      result.proposalPath,
      {
        gatePassed: true,
        proReviewPassed: false,
        humanConfirmed: false
      },
      repoRoot
    )
  ).toThrow(/must be true/);

  applySubAgentProposal(
    result.proposalPath,
    {
      gatePassed: true,
      proReviewPassed: true,
      humanConfirmed: true
    },
    repoRoot
  );

  expect(readFileSync(join(repoRoot, 'target.txt'), 'utf8')).toBe('after');
  expect(runner).toHaveBeenCalledTimes(1);
}

describe('subagent dispatch + merge gates', () => {
  it('creates a patch proposal in isolation without mutating the primary worktree', () => withRepo(verifyDispatchIsolation));

  it('only applies proposal when all gates are true', () => withRepo(verifyMergeGateRules));
});
