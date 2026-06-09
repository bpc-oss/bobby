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

const commandOracle = new CommandExitOracle();
const fileDiffOracle = new FileDiffOracle();

describe('CommandExitOracle exit codes', () => {
  it('exitCode 0 -> pass', async () => {
    const verdict = await commandOracle.judge(ac, [makeEvidence('command_output', { exitCode: 0 })]);
    expect(verdict.result).toBe('pass');
  });

  it('exitCode non-zero -> fail', async () => {
    const verdict = await commandOracle.judge(ac, [makeEvidence('command_output', { exitCode: 1, stderr: 'boom' })]);
    expect(verdict.result).toBe('fail');
    expect(verdict.detail).toContain('"exitCode":1');
  });

  it('multiple command_output with one non-zero -> fail', async () => {
    const verdict = await commandOracle.judge(ac, [
      makeEvidence('command_output', { exitCode: 0 }),
      makeEvidence('command_output', { exitCode: 1 }),
    ]);
    expect(verdict.result).toBe('fail');
    expect(verdict.detail).toContain('"exitCode":1');
  });

  it('multiple command_output with one invalid -> fail', async () => {
    const verdict = await commandOracle.judge(ac, [
      makeEvidence('command_output', { exitCode: 0 }),
      makeEvidence('command_output', { exitCode: '1' }),
    ]);
    expect(verdict.result).toBe('fail');
    expect(verdict.detail).toContain('"exitCode":"1"');
  });
});

describe('CommandExitOracle exact stdout', () => {
  it('checks exact stdout when the AC requires exact command output', async () => {
    const exactAc: AcceptanceCriterion = {
      id: 'AC1',
      desc: "The command outputs exactly 'hi' to stdout.",
      oracleHint: 'run'
    };

    const pass = await commandOracle.judge(exactAc, [makeEvidence('command_output', { exitCode: 0, stdout: 'hi' })]);
    const fail = await commandOracle.judge(exactAc, [makeEvidence('command_output', { exitCode: 0, stdout: 'hi\n' })]);

    expect(pass.result).toBe('pass');
    expect(fail.result).toBe('fail');
    expect(fail.detail).toContain('stdout did not match exact expected text');
  });

  it('does not treat command wording as strict stdout expectation by default', async () => {
    const exactAc: AcceptanceCriterion = {
      id: 'AC1',
      desc: 'run command exactly once',
      oracleHint: 'run'
    };

    const verdict = await commandOracle.judge(exactAc, [makeEvidence('command_output', { exitCode: 0 })]);

    expect(verdict.result).toBe('pass');
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

describe('FileDiffOracle basic diff evidence', () => {
  it('file_diff with bytes>0 and non-empty path -> pass', async () => {
    const verdict = await fileDiffOracle.judge(ac, [makeEvidence('file_diff', { path: '/tmp/a.txt', bytes: 4 })]);
    expect(verdict.result).toBe('pass');
  });

  it('file_diff with bytes 0 -> fail', async () => {
    const verdict = await fileDiffOracle.judge(ac, [makeEvidence('file_diff', { path: '/tmp/a.txt', bytes: 0 })]);
    expect(verdict.result).toBe('fail');
    expect(verdict.detail).toContain('file diff evidence check failed');
  });

  it('file_diff with empty path -> fail', async () => {
    const verdict = await fileDiffOracle.judge(ac, [makeEvidence('file_diff', { path: '', bytes: 1 })]);
    expect(verdict.result).toBe('fail');
    expect(verdict.detail).toContain('"path":""');
  });
});

describe('FileDiffOracle quoted exact file content', () => {
  it('checks exact file content when the AC requires exact content', async () => {
    const exactAc: AcceptanceCriterion = {
      id: 'AC1',
      desc: "The content of hello.txt is exactly 'hi' (no extra spaces, newlines, or characters).",
      oracleHint: 'file'
    };

    const pass = await fileDiffOracle.judge(exactAc, [
      makeEvidence('file_diff', { path: '/tmp/hello.txt', bytes: 2, content: 'hi' })
    ]);
    const fail = await fileDiffOracle.judge(exactAc, [
      makeEvidence('file_diff', { path: '/tmp/hello.txt', bytes: 3, content: 'hi\n' })
    ]);

    expect(pass.result).toBe('pass');
    expect(fail.result).toBe('fail');
    expect(fail.detail).toContain('file content did not match exact expected text');
  });
});

describe('FileDiffOracle exact file-name guard', () => {
  it('does not treat file-name/path-like "exactly" as file content requirement', async () => {
    const nameAc: AcceptanceCriterion = {
      id: 'AC1',
      desc: 'The file is named exactly hello.txt',
      oracleHint: 'file'
    };

    const verdict = await fileDiffOracle.judge(nameAc, [
      makeEvidence('file_diff', { path: '/tmp/hello.txt', bytes: 2, content: 'hi' })
    ]);

    expect(verdict.result).toBe('pass');
  });
});

describe('FileDiffOracle inferred exact file content', () => {
  it('checks exact file content for unquoted contains/has phrasing', async () => {
    const containsAc: AcceptanceCriterion = {
      id: 'AC1',
      desc: 'hello.txt contains exactly hi',
      oracleHint: 'file'
    };
    const hasAc: AcceptanceCriterion = {
      id: 'AC1',
      desc: 'hello.txt has exactly hi',
      oracleHint: 'file'
    };

    const passContains = await fileDiffOracle.judge(containsAc, [
      makeEvidence('file_diff', { path: '/tmp/hello.txt', bytes: 2, content: 'hi' })
    ]);
    const failContains = await fileDiffOracle.judge(containsAc, [
      makeEvidence('file_diff', { path: '/tmp/hello.txt', bytes: 3, content: 'hi\n' })
    ]);
    const passHas = await fileDiffOracle.judge(hasAc, [
      makeEvidence('file_diff', { path: '/tmp/hello.txt', bytes: 2, content: 'hi' })
    ]);

    expect(passContains.result).toBe('pass');
    expect(failContains.result).toBe('fail');
    expect(failContains.detail).toContain('file content did not match exact expected text');
    expect(passHas.result).toBe('pass');
  });

  it('checks exact file content when AC says exactly the string', async () => {
    const stringAc: AcceptanceCriterion = {
      id: 'AC1',
      desc: "hello.txt contains exactly the string 'hi'",
      oracleHint: 'file'
    };

    const pass = await fileDiffOracle.judge(stringAc, [
      makeEvidence('file_diff', { path: '/tmp/hello.txt', bytes: 2, content: 'hi' })
    ]);
    const fail = await fileDiffOracle.judge(stringAc, [
      makeEvidence('file_diff', { path: '/tmp/hello.txt', bytes: 3, content: 'the' })
    ]);

    expect(pass.result).toBe('pass');
    expect(fail.result).toBe('fail');
  });
});
