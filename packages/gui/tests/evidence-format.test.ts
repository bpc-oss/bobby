import { expect, it } from 'vitest';

import type { Evidence } from '@bobby/shared';

import { toPlainLanguage } from '../src/lib/evidence-format';

const makeEvidence = (overrides: Partial<Evidence>): Evidence => ({
  claimId: 'claim-1',
  acId: 'AC1',
  evidenceType: 'command_output',
  payload: {},
  producedBy: 'tool',
  ...overrides
});

it('formats successful command_output with stdout', () => {
  const ev = makeEvidence({
    evidenceType: 'command_output',
    payload: {
      exitCode: 0,
      stdout: 'all good',
      stderr: 'ignored'
    }
  });

  const plain = toPlainLanguage(ev);

  expect(plain.ok).toBe(true);
  expect(plain.summary).toMatch(/运行|成功/);
  expect(plain.detail).toContain('all good');
});

it('formats failed command_output without sugar-coating', () => {
  const ev = makeEvidence({
    evidenceType: 'command_output',
    payload: {
      exitCode: 1,
      stderr: 'boom'
    }
  });

  const plain = toPlainLanguage(ev);

  expect(plain.ok).toBe(false);
  expect(plain.summary).toContain('失败');
  expect(plain.summary).not.toMatch(/成功/);
  expect(plain.detail).toContain('boom');
});

it('formats existing file_exists as pass', () => {
  const ev = makeEvidence({
    evidenceType: 'file_exists',
    payload: {
      path: '/tmp/project.txt',
      exists: true
    }
  });

  const plain = toPlainLanguage(ev);

  expect(plain.ok).toBe(true);
  expect(plain.summary).toContain('已生成');
  expect(plain.detail).toContain('/tmp/project.txt');
});

it('formats missing file_exists as fail', () => {
  const ev = makeEvidence({
    evidenceType: 'file_exists',
    payload: {
      path: '/tmp/missing.txt',
      exists: false
    }
  });

  const plain = toPlainLanguage(ev);

  expect(plain.ok).toBe(false);
  expect(plain.summary).toContain('未生成');
  expect(plain.detail).toContain('/tmp/missing.txt');
});

it('formats file_diff with path and diff in readable detail', () => {
  const ev = makeEvidence({
    evidenceType: 'file_diff',
    payload: {
      path: '/tmp/result.txt',
      diff: 'diff --git a/x b/x'
    }
  });

  const plain = toPlainLanguage(ev);

  expect(plain.ok).toBe(true);
  expect(plain.summary).toContain('/tmp/result.txt');
  expect(plain.summary).toContain('修改');
  expect(plain.detail).toContain('diff');
  expect(plain.detail).toContain('/tmp/result.txt');
});

it('formats quote_with_location with loc visible in detail', () => {
  const ev = makeEvidence({
    evidenceType: 'quote_with_location',
    payload: {
      items: [{ loc: 'L1', note: 'ok' }],
      expected: 3
    }
  });

  const plain = toPlainLanguage(ev);

  expect(plain.ok).toBe(true);
  expect(plain.summary).toContain('逐项核对');
  expect(plain.detail).toContain('L1');
  expect(plain.detail).toContain('expected');
});
