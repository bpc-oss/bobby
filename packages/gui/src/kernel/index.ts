import type { KernelClient } from './client';
import { FIXTURES } from './mock/fixtures';
import { MockKernelClient } from './mock/mock-client';

let client: KernelClient | null = null;

export function getKernelClient(): KernelClient {
  if (!client) {
    client = new MockKernelClient(FIXTURES);
  }

  return client;
}

export function setKernelClient(next: KernelClient | null): void {
  client = next;
}
