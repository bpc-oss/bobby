import { expect, it } from 'vitest';

import { DeepSeekModelClient } from '../src/model/deepseek/client';
import type { ChatRequest, HttpTransport } from '../src/model/deepseek/transport';
import type { CapabilityReport } from '../src/model/deepseek/probe';
import type { ModelMessage, ModelRole } from '../src/model/model-client';

const createReport = (overrides: Partial<CapabilityReport> = {}): CapabilityReport => ({
  runnerModel: 'runner-model',
  graderModel: 'grader-model',
  useToolCalling: false,
  useJsonMode: false,
  useFim: false,
  useCaching: false,
  useReasoning: false,
  useStreaming: false,
  contextWindow: 1024,
  ...overrides
});

it('runner role uses runnerModel and returns content + raw transport response', async () => {
  const calls: ChatRequest[] = [];
  const transport: HttpTransport = {
    async chat(req) {
      calls.push(req);
      return { content: 'runner-response', model: req.model };
    }
  };
  const client = new DeepSeekModelClient({
    apiKey: 'secret-key',
    report: createReport({ useReasoning: true, useJsonMode: true }),
    transport
  });

  const messages: ModelMessage[] = [{ role: 'user', content: 'hello-runner' }];
  const response = await client.complete('runner', messages);

  expect(response).toEqual({
    content: 'runner-response',
    raw: { content: 'runner-response', model: 'runner-model' }
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]!.model).toBe('runner-model');
  expect(calls[0]!.messages).toBe(messages);
  expect(calls[0]!.reasoning).toBeUndefined();
  expect(calls[0]!.reasoningEffort).toBeUndefined();
});

it('grader with json enabled uses graderModel and sets jsonMode+reasoning when supported', async () => {
  const calls: ChatRequest[] = [];
  const transport: HttpTransport = {
    async chat(req) {
      calls.push(req);
      return { content: 'grader-response', model: req.model };
    }
  };
  const client = new DeepSeekModelClient({
    apiKey: 'secret-key',
    report: createReport({ useJsonMode: true, useReasoning: true }),
    transport
  });

  const messages: ModelMessage[] = [{ role: 'system', content: 'plan' }];
  const response = await client.complete('grader', messages, { json: true });

  expect(response.content).toBe('grader-response');
  expect(response.raw).toMatchObject({ model: 'grader-model' });
  expect(calls).toHaveLength(1);
  expect(calls[0]!.model).toBe('grader-model');
  expect(calls[0]!.jsonMode).toBe(true);
  expect(calls[0]!.reasoning).toBeUndefined();
  expect(calls[0]!.reasoningEffort).toBe('high');
});

it('grader disables reasoning when report does not support it', async () => {
  const calls: ChatRequest[] = [];
  const transport: HttpTransport = {
    async chat(req) {
      calls.push(req);
      return { content: 'grader-response', model: req.model };
    }
  };
  const client = new DeepSeekModelClient({
    apiKey: 'secret-key',
    report: createReport({ useReasoning: false, useJsonMode: true }),
    transport
  });

  const messages: ModelMessage[] = [{ role: 'system', content: 'plan' }];
  await client.complete('grader', messages, { json: true });

  expect(calls[0]!.reasoning).toBeUndefined();
  expect(calls[0]!.reasoningEffort).toBeUndefined();
});

it.each<ModelRole>(['runner', 'grader'])(
  'ignores per-call reasoningEffort when useReasoning is false (%s)',
  async (role) => {
    const calls: ChatRequest[] = [];
    const transport: HttpTransport = {
      async chat(req) {
        calls.push(req);
        return { content: 'response', model: req.model };
      }
    };
    const client = new DeepSeekModelClient({
      apiKey: 'secret-key',
      report: createReport({ useReasoning: false }),
      transport
    });

    const messages: ModelMessage[] = [{ role: 'system', content: `prompt-${role}` }];
    await client.complete(role, messages, { reasoningEffort: 'high' });

    expect(calls[0]!.reasoningEffort).toBeUndefined();
  }
);

it('grader attaches cache metadata only when useCaching is enabled', async () => {
  const calls: ChatRequest[] = [];
  const transport: HttpTransport = {
    async chat(req) {
      calls.push(req);
      return { content: 'grader-response', model: req.model };
    }
  };
  const cachingClient = new DeepSeekModelClient({
    apiKey: 'secret-key',
    report: createReport({ useCaching: true, useReasoning: true }),
    transport
  });
  const noCacheClient = new DeepSeekModelClient({
    apiKey: 'secret-key',
    report: createReport({ useCaching: false, useReasoning: true }),
    transport
  });

  const messages: ModelMessage[] = [
    { role: 'system', content: 'stable system prompt' },
    { role: 'user', content: 'grader prompt' }
  ];

  await cachingClient.complete('grader', messages, { json: true });
  await noCacheClient.complete('grader', messages, { json: true });

  expect(calls[0]!.cacheMetadata).toBeDefined();
  expect(typeof calls[0]!.cacheMetadata!.prefix).toBe('string');
  expect(typeof calls[0]!.cacheMetadata!.prefixHash).toBe('string');
  expect(typeof calls[0]!.cacheMetadata!.sessionId).toBe('string');
  expect(calls[0]!.cacheMetadata!.tools).toHaveLength(4);
  expect(calls[1]!.cacheMetadata).toBeUndefined();
});

it('runner request never carries cache metadata', async () => {
  const calls: ChatRequest[] = [];
  const transport: HttpTransport = {
    async chat(req) {
      calls.push(req);
      return { content: 'runner-response', model: req.model };
    }
  };
  const client = new DeepSeekModelClient({
    apiKey: 'secret-key',
    report: createReport({ useCaching: true, useReasoning: true }),
    transport
  });

  await client.complete('runner', [{ role: 'user', content: 'runner prompt' }]);

  expect(calls).toHaveLength(1);
  expect(calls[0]!.cacheMetadata).toBeUndefined();
});

it('supports per-call model override and reasoning effort override', async () => {
  const calls: ChatRequest[] = [];
  const transport: HttpTransport = {
    async chat(req) {
      calls.push(req);
      return { content: 'runner-override', model: req.model };
    }
  };
  const client = new DeepSeekModelClient({
    apiKey: 'secret-key',
    report: createReport({ useReasoning: true, useJsonMode: true }),
    transport
  });

  const messages: ModelMessage[] = [{ role: 'user', content: 'hello-runner' }];
  const response = await client.complete('runner', messages, { model: 'custom-flash', reasoningEffort: 'low' });

  expect(response).toEqual({
    content: 'runner-override',
    raw: { content: 'runner-override', model: 'custom-flash' }
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]!.model).toBe('custom-flash');
  expect(calls[0]!.reasoningEffort).toBe('low');
  expect(calls[0]!).not.toHaveProperty('reasoning');
});

it('grader does not set jsonMode when report does not support it', async () => {
  const calls: ChatRequest[] = [];
  const transport: HttpTransport = {
    async chat(req) {
      calls.push(req);
      return { content: 'response', model: req.model };
    }
  };
  const client = new DeepSeekModelClient({
    apiKey: 'secret-key',
    report: createReport({ useJsonMode: false }),
    transport
  });

  const messages: ModelMessage[] = [{ role: 'user', content: 'json-request' }];
  await client.complete('grader', messages, { json: true });

  expect(calls).toHaveLength(1);
  expect(calls[0]!.jsonMode).toBeUndefined();
});

it('passes-through original messages to transport unchanged', async () => {
  const calls: ChatRequest[] = [];
  const transport: HttpTransport = {
    async chat(req) {
      calls.push(req);
      return { content: 'ok', model: req.model };
    }
  };
  const client = new DeepSeekModelClient({
    apiKey: 'secret-key',
    report: createReport(),
    transport
  });

  const messages: ModelMessage[] = [
    { role: 'assistant', content: 'first' },
    { role: 'user', content: 'second' }
  ];
  await client.complete('grader', messages, { json: false });

  expect(calls[0]!.messages).toBe(messages);
  expect(calls[0]!.messages).toEqual(messages);
});
