export interface MinimalAutoUpdater {
  on(event: 'update-available' | 'update-downloaded', listener: () => void): void;
  checkForUpdatesAndNotify(): Promise<unknown>;
}

async function getDefaultAutoUpdater(): Promise<MinimalAutoUpdater> {
  const pkg = await import('electron-updater');
  return (pkg.default as { autoUpdater: MinimalAutoUpdater }).autoUpdater;
}

export function initAutoUpdate(
  notify: (message: string) => void,
  updater?: MinimalAutoUpdater
): Promise<unknown> {
  return Promise.resolve()
    .then(async () => {
      const resolvedUpdater = updater ?? await getDefaultAutoUpdater();

      resolvedUpdater.on('update-available', () => {
        notify('New version found. Downloading in the background...');
      });

      resolvedUpdater.on('update-downloaded', () => {
        notify('New version is ready. Restart Bobby to apply it.');
      });

      return resolvedUpdater.checkForUpdatesAndNotify();
    })
    .catch(() => {});
}
