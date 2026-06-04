import type { SecretStore } from './keychain';

export type PermissionLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export interface Settings {
  budgetUsd: number;
  defaultPermission: PermissionLevel;
  lang?: 'zh' | 'en';
  strongSandbox: boolean;
  telemetryEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  budgetUsd: 10,
  defaultPermission: 'L1',
  strongSandbox: true,
  telemetryEnabled: false
};

export class Config {
  private readonly store: SecretStore;
  private settings: Settings;

  constructor(store: SecretStore, initialSettings: Partial<Settings> = {}) {
    this.store = store;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...initialSettings
    };
  }

  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.settings[key];
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings[key] = value;
  }

  async setApiKey(service: string, apiKey: string): Promise<void> {
    await this.store.setSecret(this.makeApiKeyKey(service), apiKey);
  }

  async getApiKey(service: string): Promise<string | null> {
    return this.store.getSecret(this.makeApiKeyKey(service));
  }

  private makeApiKeyKey(service: string): string {
    return `api-key:${service}`;
  }
}
