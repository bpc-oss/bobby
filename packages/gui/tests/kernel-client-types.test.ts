import { describe, expect, it } from 'vitest';

import { addUsage, emptyUsage } from '../src/kernel/client';

describe('usage 工具函数', () => {
  it('emptyUsage 缓存命中率为 -1（无数据）', () => {
    expect(emptyUsage().cacheHitRate).toBe(-1);
  });

  it('addUsage 累计 token 与费用，取最新命中率', () => {
    const merged = addUsage(
      { inputTokens: 100, outputTokens: 50, cacheHitRate: 0.5, cny: 0.01 },
      { inputTokens: 200, outputTokens: 100, cacheHitRate: 0.9, cny: 0.02 }
    );

    expect(merged).toEqual({
      inputTokens: 300,
      outputTokens: 150,
      cacheHitRate: 0.9,
      cny: 0.03
    });
  });
});
