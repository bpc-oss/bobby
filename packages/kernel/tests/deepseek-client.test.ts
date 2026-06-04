import { expect, it } from 'vitest';

import { DeepSeekModelClient } from '../src/model/deepseek/client';
import type { ChatRequest, HttpTransport } from '../src/model/deepseek/transport';
import type { CapabilityReport } from '../src/model/deepseek/probe';
import type { ModelMessage } from '../src/model/model-client';

const createReport = (overrides: Partial<CapabilityReport> = {}): CapabilityReport => ({
  runnerModel: 'runner-model',
  graderModel: 'grader-model',
  useToolCalling: false,
  useJsonMode: false,
  useFim: false,
  useCaching: false,
  useReasoning: false,
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
  expect(calls[0]!.reasoning).toBe(true);
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

it('runner never sets reasoning, even when capability is available', async () => {
  const calls: ChatRequest[] = [];
  const transport: HttpTransport = {
    async chat(req) {
      calls.push(req);
      return { content: 'runner-response', model: req.model };
    }
  };
  const client = new DeepSeekModelClient({
    apiKey: 'secret-key',
    report: createReport({ useReasoning: true }),
    transport
  });

  const messages: ModelMessage[] = [{ role: 'assistant', content: 'status' }];
  await client.complete('runner', messages);

  expect(calls).toHaveLength(1);
  expect(calls[0]!.reasoning).toBeUndefined();
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
