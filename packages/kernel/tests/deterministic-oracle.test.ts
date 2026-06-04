import { describe, expect, it } from 'vitest';

import { CommandExitOracle, FileExistsOracle } from '../src/conscience/oracles/deterministic';
import type { AcceptanceCriterion, Evidence } from '@bobby/shared';

const ac: AcceptanceCriterion = { id: 'AC1', desc: 'd', oracleHint: 'run' };
const makeEvidence = (evidenceType: Evidence['evidenceType'], payload: Record<string, unknown>): Evidence => ({
  claimId: 'c',
  acId: 'AC1',
  evidenceType,
  payload,
  producedBy: 'tool',
});

describe('CommandExitOracle', () => {
  const oracle = new CommandExitOracle();

  it('exitCode 0 -> pass', async () => {
    const verdict = await oracle.judge(ac, [makeEvidence('command_output', { exitCode: 0 })]);
    expect(verdict.result).toBe('pass');
  });

  it('exitCode non-zero -> fail', async () => {
    const verdict = await oracle.judge(ac, [makeEvidence('command_output', { exitCode: 1, stderr: 'boom' })]);
    expect(verdict.result).toBe('fail');
    expect(verdict.detail).toContain('"exitCode":1');
  });

  it('multiple command_output with one non-zero -> fail', async () => {
    const verdict = await oracle.judge(ac, [
      makeEvidence('command_output', { exitCode: 0 }),
      makeEvidence('command_output', { exitCode: 1 }),
    ]);
    expect(verdict.result).toBe('fail');
    expect(verdict.detail).toContain('"exitCode":1');
  });

  it('multiple command_output with one invalid -> fail', async () => {
    const verdict = await oracle.judge(ac, [
      makeEvidence('command_output', { exitCode: 0 }),
      makeEvidence('command_output', { exitCode: '1' }),
    ]);
    expect(verdict.result).toBe('fail');
    expect(verdict.detail).toContain('"exitCode":"1"');
  });
});

describe('FileExistsOracle', () => {
  const oracle = new FileExistsOracle();

  it('file_exists false -> fail', async () => {
    const verdict = await oracle.judge(ac, [makeEvidence('file_exists', { exists: false })]);
    expect(verdict.result).toBe('fail');
  });

  it('multiple file_exists with one false -> fail', async () => {
    const verdict = await oracle.judge(ac, [makeEvidence('file_exists', { exists: true }), makeEvidence('file_exists', { exists: false })]);
    expect(verdict.result).toBe('fail');
    expect(verdict.detail).toContain('"exists":false');
  });

  it('multiple file_exists with one missing -> fail', async () => {
    const verdict = await oracle.judge(ac, [makeEvidence('file_exists', { exists: true }), makeEvidence('file_exists', {})]);
    expect(verdict.result).toBe('fail');
    expect(verdict.detail).toBe('file existence check failed: {}');
  });
});
