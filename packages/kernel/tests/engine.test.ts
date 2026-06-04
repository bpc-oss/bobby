import { CommandExitOracle, FileDiffOracle, FileExistsOracle } from '../src/conscience/oracles/deterministic';
import { CoverageOracle } from '../src/conscience/oracles/coverage';
import { VerificationEngine } from '../src/conscience/engine';
import type { AcceptanceCriterion, Evidence } from '@bobby/shared';
import { describe, expect, it } from 'vitest';

const ac: AcceptanceCriterion = { id: 'AC1', desc: 'run command', oracleHint: 'run' };
const ev = (
  acId: string,
  evidenceType: Evidence['evidenceType'],
  payload: Record<string, unknown>,
): Evidence => ({
  claimId: 'c',
  acId,
  evidenceType,
  payload,
  producedBy: 'tool',
});

describe('VerificationEngine', () => {
  const engine = new VerificationEngine([
    new CoverageOracle(),
    new CommandExitOracle(),
    new FileExistsOracle(),
    new FileDiffOracle(),
  ]);

  it('uses T0 oracle first when command_output evidence exists', async () => {
    const v = await engine.verify(ac, [
      ev('AC1', 'command_output', { exitCode: 0 }),
      ev('AC1', 'quote_with_location', { items: [], expected: 0 }),
    ]);
    expect(v.oracleTier).toBe('T0');
    expect(v.result).toBe('pass');
  });

  it('rejects with /no oracle/i when no usable oracle exists', async () => {
    await expect(engine.verify(ac, [ev('AC1', 'pro_review', {})])).rejects.toThrow(/no oracle/i);
  });

  it('uses T0 file_diff oracle for write_file evidence', async () => {
    const v = await engine.verify(ac, [ev('AC1', 'file_diff', { path: '/tmp/hello.txt', bytes: 10 })]);
    expect(v.oracleTier).toBe('T0');
    expect(v.result).toBe('pass');
  });

  it('only uses evidence for matching acId', async () => {
    await expect(
      engine.verify(ac, [
        ev('AC2', 'command_output', { exitCode: 0 }),
        ev('AC2', 'file_exists', { exists: true }),
      ]),
    ).rejects.toThrow(/no oracle/i);
  });
});
