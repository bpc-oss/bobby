import { describe, expect, it } from 'vitest';
import { formatTestFailureContext, parseTestOutput } from '../src/conscience/test-feedback';

describe('parseTestOutput', () => {
  it('extracts fail/pass counts, failure titles, files and messages from Vitest output', () => {
    const vitestOutput = `
      FAIL  src/math.test.ts > Math utils > adds numbers
      AssertionError: expected 1 + 1 to be 3
        at Object.<anonymous> (src/math.test.ts:12:10)

      FAIL  src/math.test.ts > Math utils > handles decimals
      TypeError: decimals unsupported
        at src/math.test.ts:27:5

      Test Files  2 failed | 1 passed (16.3s)
    `;

    const parsed = parseTestOutput(vitestOutput);

    expect(parsed.passCount).toBe(1);
    expect(parsed.failCount).toBe(2);
    expect(parsed.failures).toHaveLength(2);
    expect(parsed.failures[0].title).toBe('Math utils > adds numbers');
    expect(parsed.failures[0].file).toBe('src/math.test.ts');
    expect(parsed.failures[0].message).toContain('AssertionError');
    expect(parsed.failures[1].title).toBe('Math utils > handles decimals');
    expect(parsed.failures[1].file).toBe('src/math.test.ts');
    expect(parsed.files).toEqual(['src/math.test.ts']);
    expect(parsed.errorMessages).toContain('AssertionError: expected 1 + 1 to be 3');
    expect(parsed.errorMessages).toContain('TypeError: decimals unsupported');
  });

  it('parses unicode failure marker without relying on terminal encoding', () => {
    const parsed = parseTestOutput(`
      \u00d7 tests/bar.test.ts > suite > fails
      AssertionError: bad value
      Test Files  1 failed | 0 passed
    `);

    expect(parsed.failCount).toBe(1);
    expect(parsed.failures[0]).toMatchObject({
      file: 'tests/bar.test.ts',
      title: 'suite > fails'
    });
  });
});

describe('formatTestFailureContext', () => {
  it('formats a concise structured retry context including title and file', () => {
    const parsed = parseTestOutput(`
      FAIL  src/foo.test.ts > suite > breaks
      Error: boom
      Test Files  1 failed, 1 passed (1.9s)
    `);

    const context = formatTestFailureContext(parsed);

    expect(context).toContain('src/foo.test.ts');
    expect(context).toContain('suite > breaks');
    expect(context).toContain('fail=');
  });
});
