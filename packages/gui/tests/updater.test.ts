import { afterEach, describe, expect, it, vi } from 'vitest';

import { initAutoUpdate } from '../electron/updater';

interface FakeUpdater {
  on: (event: 'update-available' | 'update-downloaded', listener: () => void) => void;
  checkForUpdatesAndNotify: () => Promise<void>;
}

describe('initAutoUpdate', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers update listeners and notifies with expected messages', () => {
    const listeners = new Map<'update-available' | 'update-downloaded', () => void>();
    const notify = vi.fn();
    const updater: FakeUpdater = {
      on: vi.fn((event, listener) => {
        listeners.set(event, listener);
      }),
      checkForUpdatesAndNotify: vi.fn().mockResolvedValue(undefined)
    };

    initAutoUpdate(notify, updater);

    expect(updater.on).toHaveBeenCalledTimes(2);
    expect(updater.on).toHaveBeenCalledWith('update-available', expect.any(Function));
    expect(updater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function));

    listeners.get('update-available')?.();
    expect(notify).toHaveBeenCalledWith('发现新版本，正在后台下载...');

    listeners.get('update-downloaded')?.();
    expect(notify).toHaveBeenCalledWith('新版本已就绪，重启后生效。');
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
