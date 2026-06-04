import { expect, it } from 'vitest';

import { Config, DEFAULT_SETTINGS, type Settings } from '../src/config/config';
import { MemorySecretStore, type SecretStore } from '../src/config/keychain';

class FakeSecretStore implements SecretStore {
  private readonly data = new Map<string, string>();
  public readonly getCalls: string[] = [];
  public readonly setCalls: Array<{ key: string; value: string }> = [];

  async getSecret(key: string): Promise<string | null> {
    this.getCalls.push(key);
    return this.data.get(key) ?? null;
  }

  async setSecret(key: string, value: string): Promise<void> {
    this.setCalls.push({ key, value });
    this.data.set(key, value);
  }
}

it('provides default settings and allows partial overrides', () => {
  const store = new MemorySecretStore();
  const config = new Config(store, {
    budgetUsd: 5,
    telemetryEnabled: true
  });

  expect(config.get('budgetUsd')).toBe(5);
  expect(config.get('defaultPermission')).toBe(DEFAULT_SETTINGS.defaultPermission);
  expect(config.get('strongSandbox')).toBe(DEFAULT_SETTINGS.strongSandbox);
  expect(config.get('telemetryEnabled')).toBe(true);
});

it('uses fallback defaults', () => {
  const store = new MemorySecretStore();
  const config = new Config(store);

  const expected = DEFAULT_SETTINGS;
  expect(config.get('budgetUsd')).toBe(expected.budgetUsd);
  expect(config.get('defaultPermission')).toBe(expected.defaultPermission);
  expect(config.get('strongSandbox')).toBe(true);
  expect(config.get('telemetryEnabled')).toBe(false);
});

it('supports typed get and set', () => {
  const store = new MemorySecretStore();
  const config = new Config(store);
  const settings: Settings = {
    budgetUsd: 20,
    defaultPermission: 'L3',
    lang: 'en',
    strongSandbox: false,
    telemetryEnabled: true
  };
  config.set('budgetUsd', 20);
  config.set('defaultPermission', 'L3');
  config.set('lang', 'en');
  config.set('strongSandbox', false);
  config.set('telemetryEnabled', true);

  expect(config.get('budgetUsd')).toBe(settings.budgetUsd);
  expect(config.get('defaultPermission')).toBe(settings.defaultPermission);
  expect(config.get('lang')).toBe('en');
  expect(config.get('strongSandbox')).toBe(false);
  expect(config.get('telemetryEnabled')).toBe(true);
});

it('only stores API keys in SecretStore and reads them from SecretStore', async () => {
  const store = new FakeSecretStore();
  const config = new Config(store);
  const secretValue = 'sk-test-001';

  expect(config.get('telemetryEnabled')).toBe(DEFAULT_SETTINGS.telemetryEnabled);
  await config.setApiKey('openai', secretValue);

  expect(store.setCalls).toEqual([
    {
      key: 'api-key:openai',
      value: secretValue
    }
  ]);
  await expect(config.getApiKey('openai')).resolves.toBe(secretValue);
  expect(store.getCalls).toEqual(['api-key:openai']);
  expect(config.get('budgetUsd')).toBe(DEFAULT_SETTINGS.budgetUsd);
});

it('does not inject api keys into regular settings', async () => {
  const store = new FakeSecretStore();
  const config = new Config(store);
  const unknownKey = 'api-key:deepseek';

  await config.setApiKey('deepseek', 'deepseek-key');

  expect(config.get('strongSandbox')).toBe(DEFAULT_SETTINGS.strongSandbox);
  expect(config.get('telemetryEnabled')).toBe(DEFAULT_SETTINGS.telemetryEnabled);
  expect(store.setCalls).toEqual([{ key: unknownKey, value: 'deepseek-key' }]);
  expect(await config.getApiKey('deepseek')).toBe('deepseek-key');
  const asAny = config as unknown as Record<string, unknown>;
  expect(asAny[unknownKey]).toBeUndefined();
});
