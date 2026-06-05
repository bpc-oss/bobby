import { expect, it } from 'vitest';

import {
  buildProCacheMetadata,
  hashPrefix,
  normalizePrefix,
  PRO_CACHE_TOOLS,
  getProSessionId,
  splitCacheablePrefix
} from '../src/model/deepseek/cache';
import type { ModelMessage } from '../src/model/model-client';

it('splits system messages into cacheablePrefix and user messages into dynamic', () => {
  const sys: ModelMessage = { role: 'system', content: 'system prompt' };
  const user: ModelMessage = { role: 'user', content: 'user prompt' };

  const result = splitCacheablePrefix([sys, user]);

  expect(result.cacheablePrefix).toEqual([sys]);
  expect(result.dynamic).toEqual([user]);
  expect(result.cacheablePrefix[0]).toBe(sys);
  expect(result.dynamic[0]).toBe(user);
});

it('preserves order of multiple system messages in cacheablePrefix', () => {
  const first: ModelMessage = { role: 'system', content: 'first system message' };
  const second: ModelMessage = { role: 'system', content: 'second system message' };
  const user: ModelMessage = { role: 'user', content: 'follow-up' };

  const result = splitCacheablePrefix([first, second, user]);

  expect(result.cacheablePrefix).toEqual([first, second]);
  expect(result.cacheablePrefix[0]).toBe(first);
  expect(result.cacheablePrefix[1]).toBe(second);
  expect(result.dynamic).toEqual([user]);
});

it('preserves order of user and assistant messages in dynamic', () => {
  const system: ModelMessage = { role: 'system', content: 'system' };
  const userFirst: ModelMessage = { role: 'user', content: 'ask 1' };
  const assistant: ModelMessage = { role: 'assistant', content: 'answer' };
  const userSecond: ModelMessage = { role: 'user', content: 'ask 2' };

  const result = splitCacheablePrefix([system, userFirst, assistant, userSecond]);

  expect(result.dynamic).toEqual([userFirst, assistant, userSecond]);
  expect(result.dynamic[0]).toBe(userFirst);
  expect(result.dynamic[1]).toBe(assistant);
  expect(result.dynamic[2]).toBe(userSecond);
});

it('returns empty cacheablePrefix and all messages as dynamic when no system messages exist', () => {
  const user: ModelMessage = { role: 'user', content: 'hello' };
  const assistant: ModelMessage = { role: 'assistant', content: 'hi there' };

  const result = splitCacheablePrefix([user, assistant]);

  expect(result.cacheablePrefix).toEqual([]);
  expect(result.dynamic).toEqual([user, assistant]);
  expect(result.dynamic[0]).toBe(user);
  expect(result.dynamic[1]).toBe(assistant);
});

it('builds consistent stable prefix hash for repeated identical Pro cache context', () => {
  const messages: ModelMessage[] = [
    { role: 'system', content: 'A: stable system prompt.' },
    { role: 'system', content: 'B: stable project rules.' },
    { role: 'user', content: 'ask' }
  ];

  const first = buildProCacheMetadata(messages).prefixHash;
  const second = buildProCacheMetadata(messages).prefixHash;

  expect(first).toBe(second);
});

it('normalizes same system context prefix to < 2K payload and hashes deterministically', () => {
  const longSystemPrompt = 'x'.repeat(2100);
  const messages: ModelMessage[] = [{ role: 'system', content: longSystemPrompt }];

  const prefix = normalizePrefix(messages);
  const hash = hashPrefix(prefix);

  expect(prefix.length).toBeLessThanOrEqual(2000);
  expect(hash).toBe(hashPrefix(prefix));
});

it('keeps Pro cache sessionId stable within 60-minute window and rotates afterward', () => {
  const start = new Date('2026-06-05T10:00:00.000Z');
  const almostSameWindow = new Date('2026-06-05T10:59:59.999Z');
  const nextWindow = new Date('2026-06-05T11:00:00.000Z');

  expect(getProSessionId(start)).toBe(getProSessionId(almostSameWindow));
  expect(getProSessionId(start)).not.toBe(getProSessionId(nextWindow));
});

it('exposes compact Pro tool table and enforces <=4 tools', () => {
  const tools = buildProCacheMetadata([]).tools;

  expect(tools.length).toBeLessThanOrEqual(4);
  expect(tools).toEqual(PRO_CACHE_TOOLS);
});
