import { describe, expect, it } from 'vitest';

import { Orchestrator } from '../src/brain/orchestrator';
import { MockModelClient } from '../src/model/mock-model-client';
import { CoverageOracle } from '../src/conscience/oracles/coverage';
import { VerificationEngine } from '../src/conscience/engine';
import { CompletionGate } from '../src/conscience/gate';
import type { Evidence } from '@bobby/shared';

const liarRunnerText = '我已经全部仔细检查完了，没问题';

const validRunnerJson = JSON.stringify({
  calls: [{ tool: 'write_file', input: { path: 'tmp.txt', content: 'x' } }]
});

const contractJson = JSON.stringify({
  goal: 'g',
  acceptanceCriteria: [{ id: 'AC1', desc: 'd', oracleHint: 'review' }],
  constraints: [],
  inputs: [],
  outOfScope: []
});

const stepsJson = JSON.stringify([
  { id: 'S1', desc: '执行可验证动作', satisfiesAcIds: ['AC1'], dependsOn: [] }
]);

const evidenceFor = (): Evidence[] => [
  {
    claimId: 'claim-1',
    acId: 'AC1',
    evidenceType: 'quote_with_location',
    payload: { items: [{ loc: 'L1', note: 'ok' }], expected: 3 },
    producedBy: 'tool'
  }
];

const evidenceForComplete = (): Evidence[] => [
  {
    claimId: 'claim-1',
    acId: 'AC1',
    evidenceType: 'quote_with_location',
    payload: {
      items: [{ loc: 'L1', note: 'ok' }, { loc: 'L2', note: 'ok' }, { loc: 'L3', note: 'ok' }],
      expected: 3
    },
    producedBy: 'tool'
  }
];

const runTask = async (
  evidenceProvider: () => Evidence[],
  runnerOutputs: string[] = [validRunnerJson, validRunnerJson],
  graderOutputs: string[] = []
): Promise<'done' | 'failed' | 'blocked'> => {
  const model = new MockModelClient({
    grader: [contractJson, stepsJson, ...graderOutputs],
    runner: [...runnerOutputs]
  });

  const orchestrator = new Orchestrator(model, {
    engine: new VerificationEngine([new CoverageOracle()]),
    gate: new CompletionGate(),
    evidenceFor: evidenceProvider
  });

  let status: 'done' | 'failed' | 'blocked' = 'failed';
  orchestrator.on((event) => {
    if (event.type === 'final_result') {
      status = event.status;
    }
  });

  await orchestrator.startTask('build and verify');
  return status;
};

describe('M6 Task 5 enemy regression', () => {
  it('rejects plain-text runner output that claims completion without tool calls', async () => {
    const model = new MockModelClient({
      grader: [contractJson, stepsJson],
      runner: [liarRunnerText]
    });

    const orchestrator = new Orchestrator(model, {
      engine: new VerificationEngine([new CoverageOracle()]),
      gate: new CompletionGate(),
      evidenceFor: evidenceFor
    });

    await expect(orchestrator.startTask('build and verify')).rejects.toThrow(
      'executeStep: model response is not valid JSON'
    );
  });

  it('fails when only 1/3 coverage is provided despite a completion claim', async () => {
    const status = await runTask(evidenceFor, [validRunnerJson, validRunnerJson], [validRunnerJson]);

    expect(status).toBe('failed');
  });

  it('passes when 3/3 coverage is provided', async () => {
    const status = await runTask(evidenceForComplete);

    expect(status).toBe('done');
  });
});
