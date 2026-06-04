import { describe, expect, it } from 'vitest';

import { isPlausibleKey } from '../src/lib/key-validate';

describe('isPlausibleKey', () => {
  it('rejects empty string', () => {
    expect(isPlausibleKey('')).toBe(false);
    expect(isPlausibleKey('   ')).toBe(false);
  });

  it('rejects obvious invalid formats', () => {
    expect(isPlausibleKey('hello')).toBe(false);
    expect(isPlausibleKey('apikey-sk-1234567890123456')).toBe(false);
    expect(isPlausibleKey('sk-')).toBe(false);
  });

  it('accepts valid keys with surrounding whitespace', () => {
    const key = `sk-${'a'.repeat(16)}`;
    expect(isPlausibleKey(`  ${key}  `)).toBe(true);
  });

  it('rejects short keys', () => {
    const shortKey = `sk-${'a'.repeat(15)}`;
    expect(isPlausibleKey(shortKey)).toBe(false);
  });

  it('rejects keys with illegal characters', () => {
    const badChars = `sk-${'a'.repeat(15)}!`;
    expect(isPlausibleKey(badChars)).toBe(false);
    expect(isPlausibleKey(`sk-${'a'.repeat(15)}_`)).toBe(false);
  });
});
