import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron-updater', () => ({
  default: {
    autoUpdater: {
      on: vi.fn(),
      checkForUpdatesAndNotify: vi.fn().mockResolvedValue(undefined)
    }
  }
}));

import { initAutoUpdate } from '../electron/updater';

interface FakeUpdater {
  on: (event: 'update-available' | 'update-downloaded', listener: () => void) => void;
  checkForUpdatesAndNotify: () => Promise<void>;
}

describe('initAutoUpdate', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers update listeners and notifies with expected messages', async () => {
    const listeners = new Map<'update-available' | 'update-downloaded', () => void>();
    const notify = vi.fn();
    const updater: FakeUpdater = {
      on: vi.fn((event, listener) => {
        listeners.set(event, listener);
      }),
      checkForUpdatesAndNotify: vi.fn().mockResolvedValue(undefined)
    };

    await initAutoUpdate(notify, updater);

    expect(updater.on).toHaveBeenCalledTimes(2);
    expect(updater.on).toHaveBeenCalledWith('update-available', expect.any(Function));
    expect(updater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function));

    listeners.get('update-available')?.();
    expect(notify).toHaveBeenCalledWith('New version found. Downloading in the background...');

    listeners.get('update-downloaded')?.();
    expect(notify).toHaveBeenCalledWith('New version is ready. Restart Bobby to apply it.');
  });

  it('silently swallows update check failures', async () => {
    const notify = vi.fn();
    const updater: FakeUpdater = {
      on: vi.fn(),
      checkForUpdatesAndNotify: vi.fn().mockRejectedValue(new Error('network'))
    };

    await initAutoUpdate(notify, updater);

    expect(updater.checkForUpdatesAndNotify).toHaveBeenCalledOnce();
    expect(notify).not.toHaveBeenCalled();
  });
});
