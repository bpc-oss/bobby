import { describe, it, expect } from 'vitest';
import { Orchestrator } from '../src/brain/orchestrator';
import { VerificationEngine } from '../src/conscience/engine';
import { CommandExitOracle } from '../src/conscience/oracles/deterministic';
import { CompletionGate } from '../src/conscience/gate';
import { MockModelClient } from '../src/model/mock-model-client';
import type { Evidence } from '@bobby/shared';

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

function makeOrchestrator(exitCode: number): Orchestrator {
  const model = new MockModelClient({
    grader: [contractJson, stepsJson],
    runner: ['done']
  });
  const engine = new VerificationEngine([new CommandExitOracle()]);
  const evidenceFor = (): Evidence[] => [
    {
      claimId: 'c1',
      acId: 'AC1',
      evidenceType: 'command_output',
      payload: { exitCode },
      producedBy: 'tool'
    }
  ];

  return new Orchestrator(model, {
    engine,
    gate: new CompletionGate(),
    evidenceFor
  });
}

describe('Orchestrator + CompletionGate', () => {
  it('uses exit code evidence to mark done when pass', async () => {
    const orchestrator = makeOrchestrator(0);
    let final = '';

    orchestrator.on((event) => {
      if (event.type === 'final_result') {
        final = event.status;
      }
    });

    await orchestrator.startTask('help me do work');
    expect(final).toBe('done');
  });

  it('uses exit code evidence to fail despite runner saying done', async () => {
    const orchestrator = makeOrchestrator(1);
    let final = '';

    orchestrator.on((event) => {
      if (event.type === 'final_result') {
        final = event.status;
      }
    });

    await orchestrator.startTask('help me do work');
    expect(final).toBe('failed');
  });
});
