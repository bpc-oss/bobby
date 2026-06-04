import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CompletionGate } from '../src/conscience/gate';
import { CommandExitOracle, FileDiffOracle, FileExistsOracle } from '../src/conscience/oracles/deterministic';
import { VerificationEngine } from '../src/conscience/engine';
import { MockModelClient } from '../src/model/mock-model-client';
import { Orchestrator } from '../src/brain/orchestrator';
import {
  ExecTool,
  ToolEvidenceProvider,
  ToolRegistry,
  WriteFileTool,
  Workspace,
  type PlannedCall
} from '../src/index';

const contractJson = JSON.stringify({
  goal: 'g',
  acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'run' }],
  constraints: [],
  inputs: [],
  outOfScope: []
});

const stepsJson = JSON.stringify([
  { id: 'S1', desc: 'Do work', satisfiesAcIds: ['AC1'], dependsOn: [] }
]);

const successRunnerCalls: { calls: PlannedCall[] } = {
  calls: [
    { tool: 'write_file', input: { path: 'demo/hello.py', content: 'print("hi")' } },
    { tool: 'exec', input: { cmd: 'python', args: ['demo/hello.py'] } }
  ]
};

const writeFileOnlyRunnerCalls: { calls: PlannedCall[] } = {
  calls: [{ tool: 'write_file', input: { path: 'demo/hello.py', content: 'print("hi")' } }]
};

const commandAliasRunnerCalls: { calls: PlannedCall[] } = {
  calls: [
    { tool: 'write_file', input: { path: 'demo/hello.py', content: 'console.log("hi")' } },
    { tool: 'exec', input: { command: 'node demo/hello.py' } }
  ]
};

const failedRunnerCalls: { calls: PlannedCall[] } = {
  calls: [{ tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }]
};

const unknownToolRunnerCalls: { calls: PlannedCall[] } = {
  calls: [{ tool: 'unknown_tool', input: { foo: 'bar' } }]
};

const withWorkspace = async <T>(fn: (workspaceRoot: string) => Promise<T>): Promise<T> => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-kernel-orchestrator-gated-'));
  try {
    return await fn(workspaceRoot);
  } finally {
    rmSync(workspaceRoot, { force: true, recursive: true });
  }
};

const makeConscience = (workspaceRoot: string, calls: PlannedCall[]) => {
  const registry = new ToolRegistry();
  const ws = new Workspace(workspaceRoot);
  registry.register(new ExecTool(workspaceRoot));
  registry.register(new WriteFileTool(ws));

  const provider = new ToolEvidenceProvider(registry);
  const engine = new VerificationEngine([new CommandExitOracle(), new FileDiffOracle(), new FileExistsOracle()]);
  const gate = new CompletionGate();

  return {
    engine,
    gate,
    evidenceFor: (_stepId: string, acIds: string[]) => provider.evidenceFor(_stepId, acIds, calls)
  };
};

const makeOrchestrator = (workspaceRoot: string, runner: string, calls: PlannedCall[]): Orchestrator => {
  const model = new MockModelClient({
    grader: [contractJson, stepsJson],
    runner: [runner]
  });

  return new Orchestrator(model, makeConscience(workspaceRoot, calls));
};

it('cannot be done when runner output is plain text', async () => {
  const model = new MockModelClient({
    grader: [contractJson, stepsJson],
    runner: ['done']
  });
  const orchestrator = new Orchestrator(model, {
    engine: new VerificationEngine([new CommandExitOracle(), new FileDiffOracle(), new FileExistsOracle()]),
    gate: new CompletionGate(),
    evidenceFor: () => []
  });

  await expect(orchestrator.startTask('help me do work')).rejects.toThrow(
    'executeStep: model response is not valid JSON'
  );
});

const collectFinalStatus = async (
  runner: string,
  calls: PlannedCall[]
): Promise<string> => {
  let final = '';
  await withWorkspace(async (workspaceRoot) => {
    const orchestrator = makeOrchestrator(workspaceRoot, runner, calls);
    orchestrator.on((event) => {
      if (event.type === 'final_result') {
        final = event.status;
      }
    });

    await orchestrator.startTask('help me do work');
  });

  return final;
};

it('finishes as done when write_file is executed and python exits 0', async () => {
  const final = await collectFinalStatus(JSON.stringify(successRunnerCalls), successRunnerCalls.calls);

  expect(final).toBe('done');
});

it('finishes as done when write_file is the only evidence-producing call', async () => {
  const final = await collectFinalStatus(
    JSON.stringify(writeFileOnlyRunnerCalls),
    writeFileOnlyRunnerCalls.calls
  );

  expect(final).toBe('done');
});

it('accepts exec command alias and still finishes with real command_output', async () => {
  const final = await collectFinalStatus(
    JSON.stringify(commandAliasRunnerCalls),
    commandAliasRunnerCalls.calls
  );

  expect(final).toBe('done');
});

it('fails when tool execution produces non-zero command_output', async () => {
  const final = await collectFinalStatus(JSON.stringify(failedRunnerCalls), failedRunnerCalls.calls);

  expect(final).toBe('failed');
});

it('fails when runner references an unknown tool', async () => {
  await expect(
    withWorkspace(async (workspaceRoot) => {
      const orchestrator = makeOrchestrator(
        workspaceRoot,
        JSON.stringify(unknownToolRunnerCalls),
        unknownToolRunnerCalls.calls
      );

      await orchestrator.startTask('help me do work');
    })
  ).rejects.toThrow('unknown tool: unknown_tool');
});
