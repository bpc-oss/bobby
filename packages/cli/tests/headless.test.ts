import { describe, expect, it, vi } from 'vitest';

import type { Evidence } from '@bobby/shared';
import { MockModelClient, KernelHost } from '@bobby/kernel';
import { VerificationEngine } from '../../kernel/src/conscience/engine';
import { CommandExitOracle } from '../../kernel/src/conscience/oracles/deterministic';
import { CompletionGate } from '../../kernel/src/conscience/gate';

import { runHeadless } from '../src/headless';

const contractJson = JSON.stringify({
  goal: 'g',
  acceptanceCriteria: [{ id: 'AC1', desc: 'run command', oracleHint: 'run' }],
  constraints: [],
  inputs: [],
  outOfScope: []
});

const stepsJson = JSON.stringify([
  { id: 'S1', desc: 'Do work', satisfiesAcIds: ['AC1'], dependsOn: [] }
]);

const makeHost = (exitCode: number): KernelHost => {
  const model = new MockModelClient({
    grader: [contractJson, stepsJson],
    runner: ['done']
  });

  const evidenceFor = (): Evidence[] => [
    {
      claimId: 'c1',
      acId: 'AC1',
      evidenceType: 'command_output',
      payload: { exitCode },
      producedBy: 'tool'
    }
  ];

  return new KernelHost(
    () => model,
    {
      engine: new VerificationEngine([new CommandExitOracle()]),
      gate: new CompletionGate(),
      evidenceFor
    }
  );
};

describe('runHeadless', () => {
  it('returns exitCode 0 when final_result status is done', async () => {
    const host = makeHost(0);
    const result = await runHeadless(host, 'do work');

    expect(result.status).toBe('done');
    expect(result.exitCode).toBe(0);
  });

  it('returns exitCode non-zero when final_result status is failed', async () => {
    const host = makeHost(1);
    const result = await runHeadless(host, 'do work');

    expect(result.status).toBe('failed');
    expect(result.exitCode).toBe(1);
  });

  it('unsubscribes after host.send resolves', async () => {
    const unsubscribe = vi.fn();
    const host = {
      subscribe: vi.fn().mockReturnValue(unsubscribe),
      send: vi.fn().mockResolvedValue(undefined)
    } as unknown as KernelHost;

    await runHeadless(host, 'anything');

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
