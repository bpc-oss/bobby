import { expect, it, vi } from 'vitest';
import { join } from 'node:path';

import {
  buildCapabilityReport,
  defaultDeepSeekProbeRaw,
  probeAndWriteCapabilities,
  type ProbeRaw
} from '../src/model/deepseek/probe';

it('builds report from default DeepSeek V4 probe raw', () => {
  const raw = defaultDeepSeekProbeRaw();
  const report = buildCapabilityReport(raw);

  expect(report).toEqual({
    runnerModel: 'deepseek-v4-flash',
    graderModel: 'deepseek-v4-pro',
    useToolCalling: true,
    useJsonMode: true,
    useFim: false,
    useCaching: true,
    useReasoning: true,
    useVision: false,
    useStreaming: false,
    contextWindow: 1_000_000
  });
});

it('writes capability report to ~/.bobby/capabilities.json with pretty JSON and no API key', async () => {
  const homeDir = '/tmp/bobby';
  let writtenPath = '';
  let writtenContent = '';

  const mkdir = vi.fn(async () => undefined);
  const writeFile = vi.fn(async (_path: string, content: string) => {
    writtenPath = _path;
    writtenContent = content;
  });

  const reportPath = await probeAndWriteCapabilities({ homeDir, mkdir, writeFile });

  expect(reportPath).toBe(join(homeDir, '.bobby', 'capabilities.json'));
  expect(mkdir).toHaveBeenCalledWith(join(homeDir, '.bobby'), { recursive: true });
  expect(writeFile).toHaveBeenCalledTimes(1);

  const parsed = JSON.parse(writtenContent);
  expect(parsed).toEqual({
    runnerModel: 'deepseek-v4-flash',
    graderModel: 'deepseek-v4-pro',
    useToolCalling: true,
    useJsonMode: true,
    useFim: false,
    useCaching: true,
    useReasoning: true,
    useVision: false,
    useStreaming: false,
    contextWindow: 1_000_000
  });
  expect(writtenContent).toContain('\n');
  expect(writtenContent).not.toContain('deepseek-key');
  expect(writtenPath).toBe(reportPath);
});

it('probes DeepSeek capabilities from the API when a key is present', async () => {
  const homeDir = '/tmp/bobby';
  let writtenContent = '';

  const mkdir = vi.fn(async () => undefined);
  const writeFile = vi.fn(async (_path: string, content: string) => {
    writtenContent = content;
  });
  const readFile = vi.fn(async (path: string) => {
    if (path.endsWith('/.bobby/key') || path.endsWith('\\.bobby\\key')) {
      return 'deepseek-key';
    }
    throw Object.assign(new Error('not found'), { code: 'ENOENT' });
  });
  const fetch = vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers({ 'content-type': 'application/json' });
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};

    if (url.endsWith('/models')) {
      return {
        ok: true,
        status: 200,
        headers,
        async json() {
          return { data: [{ id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-pro' }] };
        },
        async text() {
          return JSON.stringify({ data: [{ id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-pro' }] });
        }
      } as Response;
    }

    if (url.endsWith('/beta/completions')) {
      return {
        ok: true,
        status: 200,
        headers,
        async json() {
          return { choices: [{ text: 'mid' }] };
        },
        async text() {
          return JSON.stringify({ choices: [{ text: 'mid' }] });
        }
      } as Response;
    }

    if (url.endsWith('/chat/completions')) {
      if (body.stream === true) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/event-stream' }),
          async json() {
            return {};
          },
          async text() {
            return 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n';
          }
        } as Response;
      }

      if (Array.isArray((body.messages as Array<{ content?: unknown }> | undefined)?.[0]?.content)) {
        return {
          ok: false,
          status: 400,
          headers,
          async json() {
            return { error: 'text only' };
          },
          async text() {
            return JSON.stringify({ error: 'text only' });
          }
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        headers,
        async json() {
          return { choices: [{ message: { content: 'ok' } }] };
        },
        async text() {
          return JSON.stringify({ choices: [{ message: { content: 'ok' } }] });
        }
      } as Response;
    }

    return {
      ok: false,
      status: 404,
      headers,
      async json() {
        return {};
      },
      async text() {
        return '';
      }
    } as Response;
  });

  const reportPath = await probeAndWriteCapabilities({ homeDir, mkdir, readFile, writeFile, fetch: fetch as typeof globalThis.fetch });

  expect(reportPath).toBe(join(homeDir, '.bobby', 'capabilities.json'));
  expect(JSON.parse(writtenContent)).toEqual({
    runnerModel: 'deepseek-v4-flash',
    graderModel: 'deepseek-v4-pro',
    useToolCalling: true,
    useJsonMode: true,
    useFim: true,
    useCaching: true,
    useReasoning: true,
    useVision: false,
    useStreaming: true,
    contextWindow: 1_000_000
  });
  expect(fetch).toHaveBeenCalled();
});

it('buildCapabilityReport: uses flash and pro models when present and maps specific capability flags', () => {
  const raw: ProbeRaw = {
    models: ['alpha-model', 'DeepSeek-Flash', 'DeepSeek-Pro', 'stable'],
    toolCalling: true,
    jsonMode: false,
    fim: false,
    promptCaching: true,
    reasoningToggle: true,
    visionToggle: true,
    streaming: true,
    contextWindow: 1024
  };

  const report = buildCapabilityReport(raw);

  expect(report).toMatchObject({
    runnerModel: 'DeepSeek-Flash',
    graderModel: 'DeepSeek-Pro',
    useToolCalling: true,
    useJsonMode: false,
    useFim: false,
    useCaching: true,
    useReasoning: true,
    useVision: true,
    useStreaming: true,
    contextWindow: 1024
  });
});

it('buildCapabilityReport: falls back by index when flash/pro are not present', () => {
  const raw: ProbeRaw = {
    models: ['primary-model', 'backup-model'],
    toolCalling: false,
    jsonMode: true,
    fim: true,
    promptCaching: false,
    reasoningToggle: false,
    visionToggle: false,
    streaming: false,
    contextWindow: 2048
  };

  const report = buildCapabilityReport(raw);

  expect(report).toEqual({
    runnerModel: 'primary-model',
    graderModel: 'backup-model',
    useToolCalling: false,
    useJsonMode: true,
    useFim: true,
    useCaching: false,
    useReasoning: false,
    useVision: false,
    useStreaming: false,
    contextWindow: 2048
  });
});

it('buildCapabilityReport: uses single model for both runner and grader when only one model exists', () => {
  const raw: ProbeRaw = {
    models: ['solo-model'],
    toolCalling: false,
    jsonMode: false,
    fim: false,
    promptCaching: false,
    reasoningToggle: false,
    visionToggle: false,
    contextWindow: 512
  };

  const report = buildCapabilityReport(raw);

  expect(report.runnerModel).toBe('solo-model');
  expect(report.graderModel).toBe('solo-model');
});

it('buildCapabilityReport: propagates all boolean capability flags from raw', () => {
  const raw: ProbeRaw = {
    models: ['deepseek-flash', 'deepseek-pro'],
    toolCalling: true,
    jsonMode: true,
    fim: true,
    promptCaching: true,
    reasoningToggle: false,
    visionToggle: false,
    contextWindow: 32000
  };

  const report = buildCapabilityReport(raw);

  expect(report.useToolCalling).toBe(true);
  expect(report.useJsonMode).toBe(true);
  expect(report.useFim).toBe(true);
  expect(report.useCaching).toBe(true);
  expect(report.useReasoning).toBe(false);
  expect(report.useVision).toBe(false);
  expect(report.useStreaming).toBe(false);
});

it('buildCapabilityReport: throws clear error when no models are available', () => {
  const raw: ProbeRaw = {
    models: [],
    toolCalling: false,
    jsonMode: false,
    fim: true,
    promptCaching: false,
    reasoningToggle: true,
    visionToggle: false,
    contextWindow: 8192
  };

  expect(() => buildCapabilityReport(raw)).toThrow('models must contain at least one model');
});

it('buildCapabilityReport: passes through contextWindow directly', () => {
  const raw: ProbeRaw = {
    models: ['deepseek-flash'],
    toolCalling: true,
    jsonMode: true,
    fim: false,
    promptCaching: false,
    reasoningToggle: false,
    visionToggle: false,
    contextWindow: 65536
  };

  const report = buildCapabilityReport(raw);

  expect(report.contextWindow).toBe(raw.contextWindow);
});
