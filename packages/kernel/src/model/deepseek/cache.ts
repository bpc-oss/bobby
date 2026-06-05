import { createHash } from 'node:crypto';
import type { ModelMessage } from '../model-client';

export const PRO_CACHE_TOOLS = ['read_file', 'grep', 'replace_text', 'file_exists'] as const;
export const MAX_STABLE_PREFIX_LENGTH = 2000;
const CACHE_WINDOW_MS = 60 * 60 * 1000;

export interface ProCacheMetadata {
  prefix: string;
  prefixHash: string;
  sessionId: string;
  tools: readonly string[];
}

export function getProSessionId(now: Date = new Date()): string {
  const bucket = Math.floor(now.getTime() / CACHE_WINDOW_MS);
  return `pro-${bucket}`;
}

export function normalizePrefix(messages: ModelMessage[]): string {
  const cacheablePrefix = splitCacheablePrefix(messages).cacheablePrefix;
  const concatenated = cacheablePrefix.map((m) => `${m.role}: ${m.content}`).join('\n');

  if (concatenated.length <= MAX_STABLE_PREFIX_LENGTH) {
    return concatenated;
  }

  return concatenated.slice(0, MAX_STABLE_PREFIX_LENGTH);
}

export function hashPrefix(prefix: string): string {
  return createHash('sha256').update(prefix).digest('hex');
}

export function buildProCacheMetadata(messages: ModelMessage[], now: Date = new Date()): ProCacheMetadata {
  const prefix = normalizePrefix(messages);
  return {
    prefix,
    prefixHash: hashPrefix(prefix),
    sessionId: getProSessionId(now),
    tools: PRO_CACHE_TOOLS
  };
}

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
