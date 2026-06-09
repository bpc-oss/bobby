import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import type { AcceptanceCriterion, Evidence } from '@bobby/shared';

import { CompletionGate } from '../src/conscience/gate';
import { CommandExitOracle, FileDiffOracle, FileExistsOracle } from '../src/conscience/oracles/deterministic';
import { VerificationEngine } from '../src/conscience/engine';
import { MockModelClient } from '../src/model/mock-model-client';
import { Orchestrator, type ConscienceDeps } from '../src/brain/orchestrator';
import {
  ExecTool,
  ToolEvidenceProvider,
  ToolRegistry,
  WriteFileTool,
  Workspace,
  type PlannedCall
} from '../src/index';
import { NoForbiddenPathChecker, type ConstraintChecker, type ExecContext } from '../src/conscience/constraints';

type ContractOverrides = {
  acceptanceCriteria?: { id: string; desc: string; oracleHint: 'test' | 'run' | 'file' | 'schema' | 'review' | 'human' }[];
  constraints?: { id: string; desc: string; check: string }[];
  inputs?: string[];
  outOfScope?: string[];
};

const createContractJson = (overrides: ContractOverrides = {}) => {
  const contract = {
    goal: 'Create report files with explicit workspace changes for the given task requirements',
    acceptanceCriteria: overrides.acceptanceCriteria ?? [{ id: 'AC1', desc: 'd', oracleHint: 'run' }],
    constraints: overrides.constraints ?? [],
    inputs: overrides.inputs ?? ['workspace'],
    outOfScope: overrides.outOfScope ?? []
  };

  return JSON.stringify(contract);
};

const simpleContractJson = createContractJson();

const difficultContractJson = createContractJson({
  acceptanceCriteria: [{ id: 'AC1', desc: 'd1', oracleHint: 'human' }],
  constraints: [
    { id: 'C1', desc: 'c1', check: 'path:tmp' },
    { id: 'C2', desc: 'c2', check: 'path:tmp' },
    { id: 'C3', desc: 'c3', check: 'path:tmp' },
    { id: 'C4', desc: 'c4', check: 'path:tmp' },
    { id: 'C5', desc: 'c5', check: 'path:tmp' }
  ],
  inputs: ['large input payload with many tokens requiring extra steps'],
  outOfScope: ['legacy', 'deprecated', 'policy']
});

const stepsJson = JSON.stringify([
  { id: 'S1', desc: 'Do work', satisfiesAcIds: ['AC1'], dependsOn: [] }
]);

const multiRunStepsJson = JSON.stringify([
  { id: 'S1', desc: 'Do work for both ACs', satisfiesAcIds: ['AC1', 'AC2'], dependsOn: [] }
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

const multiRunRunnerCalls: { calls: PlannedCall[] } = {
  calls: [
    { tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(0)'] } },
    { tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }
  ]
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

type MakeConscienceOptions = {
  constraintCheckers?: ConstraintChecker[];
  context?: () => ExecContext;
  engine?: VerificationEngine;
};

const makeConscience = (
  workspaceRoot: string,
  calls: PlannedCall[],
  options: MakeConscienceOptions = {}
) => {
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
    context: options.context ?? (() => provider.context()),
    constraintCheckers: options.constraintCheckers ?? [new NoForbiddenPathChecker()],
    evidenceFor: (
      stepId: string,
      acIds: string[],
      evidenceCalls?: ReadonlyArray<PlannedCall>,
      acCriteria?: AcceptanceCriterion[]
    ) => provider.evidenceFor(stepId, acIds, evidenceCalls ?? calls, acCriteria ?? [])
  };
};

const createAttemptConscience = (
  attemptEvidence: Evidence[][],
  options?: MakeConscienceOptions
): ConscienceDeps => {
  const engine =
    options?.engine ??
    new VerificationEngine([new CommandExitOracle(), new FileDiffOracle(), new FileExistsOracle()]);
  const gate = new CompletionGate();
  let callIndex = 0;

  const evidenceFor = (): Evidence[] => {
    const current = attemptEvidence[Math.min(callIndex, attemptEvidence.length - 1)] ?? [];
    callIndex += 1;
    return current;
  };

  return {
    engine,
    gate,
    evidenceFor: () => Promise.resolve(evidenceFor()),
    constraintCheckers: options?.constraintCheckers ?? [new NoForbiddenPathChecker()],
    context: options?.context
  };
};

const createAttemptModel = (
  runnerResponses: string[],
  graderResponses: string[],
  contractJson: string
): MockModelClient =>
  new MockModelClient({
    grader: [contractJson, stepsJson, ...graderResponses],
    runner: runnerResponses
  });

const collectFinalStatus = async (
  runner: string,
  calls: PlannedCall[],
  createConstraints?: (workspaceRoot: string) => { id: string; desc: string; check: string }[],
  options?: MakeConscienceOptions,
  contractJson = simpleContractJson,
  steps = stepsJson
): Promise<string> => {
  let final = '';
  const createContractWithConstraints = (constraints: { id: string; desc: string; check: string }[] | undefined): string => {
    const parsed = JSON.parse(contractJson) as Record<string, unknown>;
    if (!constraints || constraints.length === 0) {
      return JSON.stringify(parsed);
    }

    return JSON.stringify({
      ...parsed,
      constraints
    });
  };

  await withWorkspace(async (workspaceRoot) => {
    const constraints = createConstraints ? createConstraints(workspaceRoot) : [];
    const model = new MockModelClient({
      grader: [createContractWithConstraints(constraints), steps],
      runner: [runner]
    });
    const orchestrator = new Orchestrator(model, makeConscience(workspaceRoot, calls, options));
    orchestrator.on((event) => {
      if (event.type === 'final_result') {
        final = event.status;
      }
    });

    await orchestrator.startTask('help me do work');
  });

  return final;
};


const collectFinalStatusByAttempts = async (
  runnerResponses: string[],
  graderResponses: string[],
  attemptEvidence: Evidence[][],
  options?: MakeConscienceOptions,
  contractJson = simpleContractJson
): Promise<{ final: string; model: MockModelClient }> => {
  let final = '';
  const conscience = createAttemptConscience(attemptEvidence, options);

  let model!: MockModelClient;

  await withWorkspace(async () => {
    model = createAttemptModel(runnerResponses, graderResponses, contractJson);
    const orchestrator = new Orchestrator(model, conscience);
    orchestrator.on((event) => {
      if (event.type === 'final_result') {
        final = event.status;
      }
    });

    await orchestrator.startTask('help me do work');
  });

  return { final, model };
};

it('cannot be done when runner output is plain text', async () => {
  const model = new MockModelClient({
    grader: [createContractJson(), stepsJson],
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

it('isolates run-command evidence between multiple run ACs in one step', async () => {
  const contractJson = createContractJson({
    acceptanceCriteria: [
      { id: 'AC1', desc: 'AC1 command runs successfully', oracleHint: 'run' },
      { id: 'AC2', desc: 'AC2 command fails', oracleHint: 'run' }
    ]
  });

  let final = '';
  const verdicts = new Map<string, string>();

  await withWorkspace(async (workspaceRoot) => {
    const model = new MockModelClient({
      grader: [contractJson, multiRunStepsJson, JSON.stringify(multiRunRunnerCalls)],
      runner: [
        JSON.stringify(multiRunRunnerCalls),
        JSON.stringify(multiRunRunnerCalls)
      ]
    });
    const orchestrator = new Orchestrator(model, makeConscience(workspaceRoot, multiRunRunnerCalls.calls));
    orchestrator.on((event) => {
      if (event.type === 'verdict') {
        verdicts.set(event.verdict.acId, event.verdict.result);
      }
      if (event.type === 'final_result') {
        final = event.status;
      }
    });

    await orchestrator.startTask('help me do work');
  });

  expect(final).toBe('failed');
  expect(verdicts.get('AC1')).toBe('pass');
  expect(verdicts.get('AC2')).toBe('fail');
});

it('retries runner on failure and finishes when second runner attempt passes', async () => {
  const { final, model } = await collectFinalStatusByAttempts(
    [
      JSON.stringify({
        calls: [{ tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }]
      }),
      JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'demo/hello.txt', content: 'ok' } }] })
    ],
    [],
    [
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'command_output', payload: { exitCode: 1 }, producedBy: 'tool' }],
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'file_diff', payload: { path: 'demo/hello.txt', bytes: 10 }, producedBy: 'tool' }]
    ],
    {
      constraintCheckers: [new NoForbiddenPathChecker()]
    },
    difficultContractJson
  );

  expect(final).toBe('done');
  const stepCalls = model.calls.slice(2);
  expect(stepCalls).toHaveLength(2);
  expect(stepCalls.every((call) => call.role === 'runner')).toBe(true);
});

it('limits simple tasks to low retry budget and still returns failed when runner cannot pass', async () => {
  const { final, model } = await collectFinalStatusByAttempts(
    [
      JSON.stringify({ calls: [{ tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }] }),
      JSON.stringify({ calls: [{ tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }] }),
      JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'demo/hello.txt', content: 'ok' } }] })
    ],
    [JSON.stringify(failedRunnerCalls)],
    [
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'command_output', payload: { exitCode: 1 }, producedBy: 'tool' }],
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'command_output', payload: { exitCode: 1 }, producedBy: 'tool' }]
    ],
    undefined,
    simpleContractJson
  );

  expect(final).toBe('failed');
  const runnerCalls = model.calls.filter((call) => call.role === 'runner');
  expect(runnerCalls).toHaveLength(1);
});

it('allows harder tasks more runner attempts before giving up and can pass later', async () => {
  const { final, model } = await collectFinalStatusByAttempts(
    [
      JSON.stringify({ calls: [{ tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }] }),
      JSON.stringify({ calls: [{ tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }] }),
      JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'demo/hello.txt', content: 'ok' } }] })
    ],
    [],
    [
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'command_output', payload: { exitCode: 1 }, producedBy: 'tool' }],
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'command_output', payload: { exitCode: 1 }, producedBy: 'tool' }],
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'file_diff', payload: { path: 'demo/hello.txt', bytes: 10 }, producedBy: 'tool' }]
    ],
    {
      constraintCheckers: [new NoForbiddenPathChecker()]
    },
    difficultContractJson
  );

  expect(final).toBe('done');
  const runnerCalls = model.calls.filter((call) => call.role === 'runner');
  expect(runnerCalls).toHaveLength(3);
  expect(runnerCalls.length).toBeGreaterThan(1);
});

it('retries runner with structured failure context from test command output', async () => {
  const { final, model } = await collectFinalStatusByAttempts(
    [
      JSON.stringify({
        calls: [{ tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }]
      }),
      JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'demo/hello.txt', content: 'ok' } }] })
    ],
    [],
    [
      [
        {
          claimId: 'S1',
          acId: 'AC1',
          evidenceType: 'command_output',
          payload: {
            exitCode: 1,
            stdout: 'FAIL  src/math.test.ts > Math utils > adds numbers\nAssertionError: expected 1 + 1 to be 3\nTest Files  1 failed, 1 passed (1.1s)'
          },
          producedBy: 'tool'
        }
      ],
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'file_diff', payload: { path: 'demo/hello.txt', bytes: 10 }, producedBy: 'tool' }]
    ],
      {
        constraintCheckers: [new NoForbiddenPathChecker()]
      },
      difficultContractJson
  );

  expect(final).toBe('done');
  const runnerCalls = model.calls.filter((call) => call.role === 'runner');
  expect(runnerCalls).toHaveLength(2);
  const retryPrompt = runnerCalls[1].messages.find((message) => message.role === 'user');

  expect(retryPrompt?.content).toContain('Previous test failures (retry context):');
  expect(retryPrompt?.content).toContain('fail=1');
  expect(retryPrompt?.content).toContain('src/math.test.ts');
  expect(retryPrompt?.content).toContain('Math utils > adds numbers');
});

it('keeps failure decision based on evidence even when test logs are present', async () => {
  const { final } = await collectFinalStatusByAttempts(
    [
      JSON.stringify({
        calls: [{ tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }]
      }),
      JSON.stringify({
        calls: [{ tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }]
      })
    ],
    [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'demo/hello.txt', content: 'ok' } }] })],
    [
      [
        {
          claimId: 'S1',
          acId: 'AC1',
          evidenceType: 'command_output',
          payload: {
            exitCode: 1,
            stdout: 'Test Files  1 passed, 0 failed (1.1s)'
          },
          producedBy: 'tool'
        }
      ],
      [
        {
          claimId: 'S1',
          acId: 'AC1',
          evidenceType: 'command_output',
          payload: { exitCode: 1 },
          producedBy: 'tool'
        }
      ],
      [
        {
          claimId: 'S1',
          acId: 'AC1',
          evidenceType: 'command_output',
          payload: { exitCode: 1 },
          producedBy: 'tool'
        }
      ]
    ]
  );

  expect(final).toBe('failed');
});

it('stops at first runner attempt when a need_human verdict is encountered', async () => {
  const needHumanOracle = {
    tier: 'T4' as const,
    name: 'manual-review',
    canJudge: () => true,
    judge: async () => ({
      claimId: 'S1',
      acId: 'AC1',
      oracleTier: 'T4' as const,
      result: 'need_human' as const,
      detail: 'manual confirmation needed'
    })
  };

  const { final, model } = await collectFinalStatusByAttempts(
    [
      JSON.stringify({ calls: [{ tool: 'exec', input: { cmd: 'python', args: ['demo.py'] } }] }),
      JSON.stringify({ calls: [{ tool: 'exec', input: { cmd: 'python', args: ['demo.py'] } }] })
    ],
    [JSON.stringify({ calls: [{ tool: 'write_file', input: { path: 'demo/hello.txt', content: 'ok' } }] })],
    [
      [
        {
          claimId: 'S1',
          acId: 'AC1',
          evidenceType: 'command_output',
          payload: { exitCode: 0 },
          producedBy: 'tool'
        }
      ],
      [
        {
          claimId: 'S1',
          acId: 'AC1',
          evidenceType: 'command_output',
          payload: { exitCode: 0 },
          producedBy: 'tool'
        }
      ]
    ],
    {
      engine: new VerificationEngine([needHumanOracle])
    }
  );

  expect(final).toBe('blocked');
  const stepCalls = model.calls.slice(2);
  expect(stepCalls).toHaveLength(1);
  expect(stepCalls[0]).toMatchObject({ role: 'runner' });
});

it('escalates to grader after repeated runner failures and succeeds with grader output', async () => {
  const { final, model } = await collectFinalStatusByAttempts(
    [
      JSON.stringify({
        calls: [{ tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }]
      }),
      JSON.stringify({
        calls: [{ tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }]
      })
    ],
    [
      JSON.stringify({
        calls: [{ tool: 'write_file', input: { path: 'demo/hello.txt', content: 'ok' } }]
      })
    ],
    [
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'command_output', payload: { exitCode: 1 }, producedBy: 'tool' }],
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'file_diff', payload: { path: 'demo/hello.txt', bytes: 10 }, producedBy: 'tool' }]
    ],
    undefined,
    simpleContractJson
  );

  expect(final).toBe('done');
  const stepCalls = model.calls.slice(2);
  const runnerCalls = stepCalls.filter((call) => call.role === 'runner');
  const graderCalls = stepCalls.filter((call) => call.role === 'grader');
  expect(runnerCalls).toHaveLength(1);
  expect(graderCalls).toHaveLength(1);
});

it('does not complete when needsPro is set and evidence keeps failing', async () => {
  const { final, model } = await collectFinalStatusByAttempts(
    [
      JSON.stringify({
        calls: [{ tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }],
        needsPro: true
      })
    ],
    [
      JSON.stringify({
        calls: [{ tool: 'exec', input: { cmd: 'python', args: ['-c', 'import sys; sys.exit(1)'] } }]
      })
    ],
    [
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'command_output', payload: { exitCode: 1 }, producedBy: 'tool' }],
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'command_output', payload: { exitCode: 1 }, producedBy: 'tool' }]
    ]
  );

  expect(final).toBe('failed');
  expect(final).not.toBe('done');
  const stepCalls = model.calls.slice(2);
  const runnerCalls = stepCalls.filter((call) => call.role === 'runner');
  const graderCalls = stepCalls.filter((call) => call.role === 'grader');
  expect(runnerCalls).toHaveLength(1);
  expect(graderCalls).toHaveLength(1);
});

it('accepts exec command alias and still finishes with real command_output', async () => {
  const final = await collectFinalStatus(
    JSON.stringify(commandAliasRunnerCalls),
    commandAliasRunnerCalls.calls
  );

  expect(final).toBe('done');
});

it('fails when tool execution produces non-zero command_output', async () => {
  const { final } = await collectFinalStatusByAttempts(
    [JSON.stringify(failedRunnerCalls), JSON.stringify(failedRunnerCalls)],
    [JSON.stringify(failedRunnerCalls)],
    [
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'command_output', payload: { exitCode: 1 }, producedBy: 'tool' }],
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'command_output', payload: { exitCode: 1 }, producedBy: 'tool' }],
      [{ claimId: 'S1', acId: 'AC1', evidenceType: 'command_output', payload: { exitCode: 1 }, producedBy: 'tool' }]
    ]
  );

  expect(final).toBe('failed');
});

it('fails when runner references an unknown tool', async () => {
  await expect(
    withWorkspace(async (workspaceRoot) => {
      const model = new MockModelClient({
        grader: [createContractJson(), stepsJson],
        runner: [JSON.stringify(unknownToolRunnerCalls)]
      });
      const orchestrator = new Orchestrator(model, makeConscience(workspaceRoot, unknownToolRunnerCalls.calls));

      await orchestrator.startTask('help me do work');
    })
  ).rejects.toThrow('unknown tool: unknown_tool');
});

it('finishes as failed when contract constraint is hit by touched path', async () => {
  const final = await collectFinalStatus(
    JSON.stringify({
      calls: [{ tool: 'write_file', input: { path: `src/legacy/entry.ts`, content: 'console.log("legacy")' } }]
    }),
    [{ tool: 'write_file', input: { path: `src/legacy/entry.ts`, content: 'console.log("legacy")' } }],
    (workspaceRoot) => {
      const forbidden = join(workspaceRoot, 'src', 'legacy');
      return [{ id: 'C1', desc: 'forbid legacy', check: `path:${forbidden}${sep}` }];
    }
  );

  expect(final).toBe('failed');
});

it('finishes as done when constraint is safe and AC passes', async () => {
  const final = await collectFinalStatus(
    JSON.stringify({
      calls: [{ tool: 'write_file', input: { path: `src/app/main.ts`, content: 'console.log("app")' } }]
    }),
    [{ tool: 'write_file', input: { path: `src/app/main.ts`, content: 'console.log("app")' } }],
    (workspaceRoot) => {
      const forbidden = join(workspaceRoot, 'src', 'legacy');
      return [{ id: 'C1', desc: 'forbid legacy', check: `path:${forbidden}${sep}` }];
    }
  );

  expect(final).toBe('done');
});
