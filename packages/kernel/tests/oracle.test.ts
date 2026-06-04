import { describe, expect, it } from 'vitest';
import { tierRank } from '../src/conscience/oracle';

describe('tierRank', () => {
  it('T0 should be harder than T2, and T2 should be harder than T4', () => {
    expect(tierRank('T0')).toBeLessThan(tierRank('T2'));
    expect(tierRank('T2')).toBeLessThan(tierRank('T4'));
  });
});
