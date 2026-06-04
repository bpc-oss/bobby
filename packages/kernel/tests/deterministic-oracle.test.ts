import { describe, expect, it } from 'vitest';

import { CommandExitOracle, FileDiffOracle, FileExistsOracle } from '../src/conscience/oracles/deterministic';
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

describe('FileDiffOracle', () => {
  const oracle = new FileDiffOracle();

  it('file_diff with bytes>0 and non-empty path -> pass', async () => {
    const verdict = await oracle.judge(ac, [makeEvidence('file_diff', { path: '/tmp/a.txt', bytes: 4 })]);
    expect(verdict.result).toBe('pass');
  });

  it('file_diff with bytes 0 -> fail', async () => {
    const verdict = await oracle.judge(ac, [makeEvidence('file_diff', { path: '/tmp/a.txt', bytes: 0 })]);
    expect(verdict.result).toBe('fail');
    expect(verdict.detail).toContain('file diff evidence check failed');
  });

  it('file_diff with empty path -> fail', async () => {
    const verdict = await oracle.judge(ac, [makeEvidence('file_diff', { path: '', bytes: 1 })]);
    expect(verdict.result).toBe('fail');
    expect(verdict.detail).toContain('"path":""');
  });
});
