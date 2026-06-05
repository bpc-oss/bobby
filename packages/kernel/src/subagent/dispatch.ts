import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

import type { SubAgentDescriptor } from './agent-loader';

export interface SubAgentDispatchResult {
  proposalPath: string;
  proposalId: string;
  worktreePath: string;
}

export interface SubagentMergeCheck {
  gatePassed: boolean;
  proReviewPassed: boolean;
  humanConfirmed: boolean;
}

export interface RunInWorktree {
  (agent: SubAgentDescriptor, task: string, worktreePath: string): Promise<void> | void;
}

export interface DispatchOptions {
  repoRoot?: string;
  proposalRoot?: string;
  runInWorktree?: RunInWorktree;
}

function runCommand(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8'
  });

  if (result.error) {
    throw new Error(`Command failed to start: ${command} ${args.join(' ')}: ${result.error.message}`);
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    const stderr = result.stderr?.toString() ?? '';
    throw new Error(`Command failed: ${command} ${args.join(' ')}\n${stderr}`);
  }

  return result.stdout?.toString() ?? '';
}

export async function dispatchSubAgent(
  agent: SubAgentDescriptor,
  task: string,
  options: DispatchOptions
): Promise<SubAgentDispatchResult> {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const proposalRoot = resolve(options.proposalRoot ?? join(repoRoot, '.bobby', 'proposals'));
  const worktreePath = join(tmpdir(), `bobby-subagent-worktree-${randomUUID()}`);
  const runInWorktree = options.runInWorktree;
  if (!runInWorktree) {
    throw new Error('runInWorktree is required for dispatch execution');
  }

  mkdirSync(proposalRoot, { recursive: true });

  try {
    runCommand('git', ['worktree', 'add', '--detach', worktreePath], repoRoot);
    await runInWorktree(agent, task, worktreePath);
    const diff = runCommand('git', ['diff', '--binary', 'HEAD'], worktreePath);
    const proposalId = randomUUID();
    const proposalPath = join(proposalRoot, `${proposalId}.patch`);
    writeFileSync(proposalPath, diff, 'utf8');

    return {
      proposalPath,
      proposalId,
      worktreePath
    };
  } finally {
    runCommand('git', ['worktree', 'remove', '--force', worktreePath], repoRoot);
    rmSync(worktreePath, { recursive: true, force: true });
  }
}

export function applySubAgentProposal(
  proposalPath: string,
  mergeCheck: SubagentMergeCheck,
  repoRoot: string = process.cwd()
): void {
  if (!(mergeCheck.gatePassed && mergeCheck.proReviewPassed && mergeCheck.humanConfirmed)) {
    throw new Error('Proposal merge denied: gate/proReview/human all must be true');
  }

  runCommand('git', ['apply', '--whitespace=nowarn', proposalPath], resolve(repoRoot));
}
