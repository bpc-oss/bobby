import type { ModelMessage } from '../model-client';

export function splitCacheablePrefix(messages: ModelMessage[]): {
  cacheablePrefix: ModelMessage[];
  dynamic: ModelMessage[];
} {
  const cacheablePrefix: ModelMessage[] = [];
  const dynamic: ModelMessage[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      cacheablePrefix.push(message);
      continue;
    }
    dynamic.push(message);
  }

  return { cacheablePrefix, dynamic };
}
