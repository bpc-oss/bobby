import { expect, it, vi } from 'vitest';

import { FetchTransport } from '../src/model/deepseek/transport';

const makeFakeResponse = (body: unknown, status = 200, ok = true) =>
  ({
    ok,
    status,
    json: async () => body
  }) as Response;

const readJson = async (value: string): Promise<unknown> => {
  const raw = JSON.parse(value);
  return raw;
};

it('chat sends DeepSeek-compatible request including response_format and thinking mode', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];

  const fakeFetch = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({
      url,
      init: init ?? {}
    });

    if (typeof init?.body === 'string') {
      const parsed = (await readJson(init.body)) as Record<string, unknown>;
      expect(parsed.model).toBe('deepseek-v4-flash');
      expect(parsed.messages).toEqual([{ role: 'user', content: 'hello' }]);
      expect(parsed.stream).toBe(false);
      expect(parsed.thinking).toEqual({ type: 'enabled' });
      expect(parsed.reasoning_effort).toBe('high');
      expect(parsed.response_format).toEqual({ type: 'json_object' });
    }

    return makeFakeResponse({
      choices: [{ message: { content: 'ok' } }],
      model: 'deepseek-v4-flash',
      usage: { prompt_tokens: 3, completion_tokens: 4, cached_tokens: 5 }
    });
  });

  const transport = new FetchTransport({
    apiKey: 'token',
    fetch: fakeFetch
  });

  const response = await transport.chat({
    model: 'deepseek-v4-flash',
    messages: [{ role: 'user', content: 'hello' }],
    jsonMode: true,
    reasoning: true
  });

  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe('https://api.deepseek.com/chat/completions');
  expect(calls[0]!.init.headers).toMatchObject({
    'content-type': 'application/json',
    authorization: 'Bearer token'
  });
  expect(response.content).toBe('ok');
  expect(response.model).toBe('deepseek-v4-flash');
  expect(response.usage).toEqual({
    promptTokens: 3,
    completionTokens: 4,
    cachedTokens: 5
  });
});

it('chat can disable thinking and maps snake_case usage to camelCase', async () => {
  const fakeFetch = vi.fn(async () => {
    return makeFakeResponse({
      choices: [{ message: { content: 'yes' } }],
      model: 'deepseek-v4-pro',
      usage: { prompt_tokens: 1, completion_tokens: 2 }
    });
  });

  const transport = new FetchTransport({
    apiKey: 'token',
    baseUrl: 'https://example.test/',
    fetch: fakeFetch
  });

  const response = await transport.chat({
    model: 'deepseek-v4-pro',
    messages: [{ role: 'assistant', content: 'status' }],
    reasoning: false
  });

  const firstCall = fakeFetch.mock.calls[0] as Array<unknown> | undefined;
  if (!firstCall || firstCall.length < 2 || firstCall[1] === undefined) {
    throw new Error('fetch not called with expected request body');
  }

  const requestBody = JSON.parse((firstCall[1] as { body: string }).body);
  expect(requestBody.thinking).toEqual({ type: 'disabled' });
  expect(requestBody.reasoning_effort).toBeUndefined();
  expect(response).toEqual({
    content: 'yes',
    model: 'deepseek-v4-pro',
    usage: {
      promptTokens: 1,
      completionTokens: 2
    }
  });
});

it('chat throws error and exposes HTTP status for non-2xx responses', async () => {
  const fakeFetch = vi.fn(async () => {
    return makeFakeResponse({ error: 'forbidden' }, 403, false);
  });

  const transport = new FetchTransport({
    apiKey: 'token',
    fetch: fakeFetch
  });

  await expect(
    transport.chat({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'x' }],
      reasoning: false
    })
  ).rejects.toMatchObject({
    status: 403
  });
});
