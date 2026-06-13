export const UI_LANG_KEY = 'bobby.ui.lang';
export const UI_PROJECT_KEY = 'bobby.ui.project';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readStoredValue(key: string): string | undefined {
  if (!canUseStorage()) return undefined;
  const value = window.localStorage.getItem(key);
  return value ?? undefined;
}

export function writeStoredValue(key: string, value?: string): void {
  if (!canUseStorage()) return;

  if (!value) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, value);
}
