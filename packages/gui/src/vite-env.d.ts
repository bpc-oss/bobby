/// <reference types="vite/client" />

import type { KernelCommand, KernelEvent } from '@bobby/shared';

declare global {
  interface Window {
    bobby: {
      send: (cmd: KernelCommand) => Promise<unknown>;
      onEvent: (callback: (event: KernelEvent) => void) => () => void;
    };
  }
}

export {};
