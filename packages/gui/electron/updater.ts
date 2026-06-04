import { autoUpdater } from 'electron-updater';

export interface MinimalAutoUpdater {
  on(event: 'update-available' | 'update-downloaded', listener: () => void): void;
  checkForUpdatesAndNotify(): Promise<unknown>;
}

export function initAutoUpdate(
  notify: (message: string) => void,
  updater: MinimalAutoUpdater = autoUpdater
): Promise<unknown> {
  updater.on('update-available', () => {
    notify('发现新版本，正在后台下载...');
  });

  updater.on('update-downloaded', () => {
    notify('新版本已就绪，重启后生效。');
  });

  return Promise.resolve()
    .then(() => updater.checkForUpdatesAndNotify())
    .catch(() => {});
}
