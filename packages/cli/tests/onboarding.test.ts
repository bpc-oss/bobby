import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';

import { readSavedDeepSeekKey } from '../src/onboarding';

describe('readSavedDeepSeekKey', () => {
  it('returns the trimmed contents of ~/.bobby/key when present', () => {
    const homeDir = '/tmp/home';
    const keyPath = join(homeDir, '.bobby', 'key');
    const existsSync = vi.fn((path: string) => path === keyPath);
    const readFileSync = vi.fn(() => 'sk-saved-key\n');

    const key = readSavedDeepSeekKey({ homeDir, existsSync, readFileSync });

    expect(key).toBe('sk-saved-key');
    expect(readFileSync).toHaveBeenCalledWith(keyPath, 'utf8');
  });

  it('returns undefined when the key file does not exist', () => {
    const existsSync = vi.fn(() => false);
    const readFileSync = vi.fn(() => '');

    const key = readSavedDeepSeekKey({ homeDir: '/tmp/home', existsSync, readFileSync });

    expect(key).toBeUndefined();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it('returns undefined when the key file is blank', () => {
    const existsSync = vi.fn(() => true);
    const readFileSync = vi.fn(() => '   \n');

    const key = readSavedDeepSeekKey({ homeDir: '/tmp/home', existsSync, readFileSync });

    expect(key).toBeUndefined();
  });
});
