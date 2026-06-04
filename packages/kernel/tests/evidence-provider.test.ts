import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';

import type { TaskContract } from '@bobby/shared';
import { expect, it } from 'vitest';

import { ToolRegistry } from '../src/hands/tool';
import { ToolEvidenceProvider } from '../src/hands/evidence-provider';
import { FileExistsTool, WriteFileTool } from '../src/hands/tools/fs';
import { Workspace } from '../src/hands/workspace';
import { enforceConstraints, NoForbiddenPathChecker } from '../src/conscience/constraints';
import { FileExistsOracle } from '../src/conscience/oracles/deterministic';
import { CompletionGate } from '../src/conscience/gate';
import { VerificationEngine } from '../src/conscience/engine';

const makeWorkspace = (): string => mkdtempSync(join(tmpdir(), 'bobby-kernel-evidence-provider-'));

async function withWorkspace<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const workspaceRoot = makeWorkspace();
  try {
    return await fn(workspaceRoot);
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

function createProvider(workspaceRoot: string) {
  const ws = new Workspace(workspaceRoot);
  const registry = new ToolRegistry();
  const writeTool = new WriteFileTool(ws);
  const existsTool = new FileExistsTool(ws);

  registry.register(writeTool);
  registry.register(existsTool);

  return {
    provider: new ToolEvidenceProvider(registry),
  };
}

it('ToolEvidenceProvider returns real evidence from planned write_file and file_exists calls', async () => {
  const stepId = 'step-write-file';
  const nestedPath = `nested${sep}a.txt`;
  const content = 'hello tool provider';

  await withWorkspace(async function (workspaceRoot) {
    const { provider } = createProvider(workspaceRoot);
    const expectedPath = join(workspaceRoot, nestedPath);

    provider.plan(stepId, [
      { tool: 'write_file', input: { path: nestedPath, content } },
      { tool: 'file_exists', input: { path: nestedPath } },
    ]);

    const evidence = await provider.evidenceFor(stepId, ['AC1']);

    expect(evidence).toHaveLength(2);
    expect(evidence.find((entry) => entry.evidenceType === 'file_diff')).toMatchObject({
      claimId: stepId,
      acId: 'AC1',
      evidenceType: 'file_diff',
      producedBy: 'tool',
      payload: {
        path: expectedPath,
        bytes: Buffer.byteLength(content),
      },
    });
    expect(evidence.find((entry) => entry.evidenceType === 'file_exists')).toMatchObject({
      claimId: stepId,
      acId: 'AC1',
      evidenceType: 'file_exists',
      producedBy: 'tool',
      payload: { path: expectedPath, exists: true },
    });
    expect(provider.context().touchedPaths).toContain(expectedPath);
  });
});

it('ToolEvidenceProvider feeds touched paths into M2 constraints', async () => {
  const touchedPath = `nested${sep}a.txt`;

  await withWorkspace(async function (workspaceRoot) {
    const { provider } = createProvider(workspaceRoot);
    provider.plan('step-touch-paths', [
      { tool: 'write_file', input: { path: touchedPath, content: 'tool evidence provider' } },
      { tool: 'file_exists', input: { path: touchedPath } },
    ]);

    await provider.evidenceFor('step-touch-paths', ['AC1']);
    const ctx = provider.context();

    expect(
      enforceConstraints(
        [{ id: 'S1', desc: 'safe-prefix', check: `path:${join(workspaceRoot, 'safe-area')}` }],
        ctx,
        [new NoForbiddenPathChecker()]
      )
    ).toEqual([{ id: 'S1', result: 'pass' }]);

    const actualPath = ctx.touchedPaths[0] ?? touchedPath;
    expect(
      enforceConstraints(
        [{ id: 'S2', desc: 'forbidden-prefix', check: `path:${dirname(actualPath)}` }],
        ctx,
        [new NoForbiddenPathChecker()]
      )
    ).toMatchObject([{ id: 'S2', result: 'fail', detail: expect.stringContaining('Forbidden path touched') }]);
  });
});

it('ToolEvidenceProvider end-to-end completion gate returns done', async () => {
  await withWorkspace(async function (workspaceRoot) {
    const { provider } = createProvider(workspaceRoot);
    const contract: TaskContract = {
      goal: 'Generate file_exists evidence for AC1',
      acceptanceCriteria: [{ id: 'AC1', desc: 'a.txt exists', oracleHint: 'file' }],
      constraints: [],
      inputs: [],
      outOfScope: [],
    };

    provider.plan('step-end-to-end', [
      { tool: 'write_file', input: { path: 'a.txt', content: 'done' } },
      { tool: 'file_exists', input: { path: 'a.txt' } },
    ]);

    const evidence = await provider.evidenceFor('step-end-to-end', [contract.acceptanceCriteria[0].id]);
    const verdict = await new VerificationEngine([new FileExistsOracle()]).verify(contract.acceptanceCriteria[0], evidence);
    const verdicts = new Map<string, typeof verdict>([[verdict.acId, verdict]]);

    expect(new CompletionGate().evaluate(contract, verdicts, [])).toMatchObject({ status: 'done', reasons: [] });
  });
});
