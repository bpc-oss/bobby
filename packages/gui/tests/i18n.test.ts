import { afterEach, describe, expect, it } from 'vitest';

import { setLang, t } from '../src/lib/i18n';

describe('i18n', () => {
  afterEach(() => {
    setLang('zh');
  });

  it('defaults to zh', () => {
    expect(t('start')).toBe('开始');
    expect(t('settings')).toBe('设置');
  });

  it('switches between zh and en', () => {
    expect(t('start')).toBe('开始');

    setLang('en');
    expect(t('start')).toBe('Start');
    expect(t('settings')).toBe('Settings');

    setLang('zh');
    expect(t('start')).toBe('开始');
  });

  it('returns unknown keys as-is', () => {
    expect(t('missing')).toBe('missing');
  });

  it('isolates language state with explicit setLang', () => {
    setLang('en');
    expect(t('allow')).toBe('Allow');

    setLang('zh');
    expect(t('allow')).toBe('允许');
  });
});
