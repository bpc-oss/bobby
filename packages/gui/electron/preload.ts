import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';

import type { KernelCommand, KernelEvent } from '@bobby/shared';

contextBridge.exposeInMainWorld('bobby', {
  send: (cmd: KernelCommand) => ipcRenderer.invoke('kernel:command', cmd),
  onEvent: (callback: (event: KernelEvent) => void) => {
    const listener = (_: IpcRendererEvent, event: KernelEvent) => {
      callback(event);
    };

    ipcRenderer.on('kernel:event', listener);

    return () => {
      ipcRenderer.removeListener('kernel:event', listener);
    };
  }
});
