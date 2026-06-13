import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';

import {
  buildCapabilityReport,
  defaultDeepSeekProbeRaw,
  fetchDeepSeekModels,
  probeAndWriteCapabilities,
  probeDeepSeek,
  type ProbeRaw
} from '../src/model/deepseek/probe';

it('builds report from default DeepSeek probe raw using real API model ids', () => {
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
    useStreaming: false,
    contextWindow: 128_000
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
    useStreaming: false,
    contextWindow: 128_000
  });
  expect(writtenContent).toContain('\n');
  expect(writtenContent).not.toContain('deepseek-key');
  expect(writtenPath).toBe(reportPath);
});

it('buildCapabilityReport: uses flash and pro models when present and maps specific capability flags', () => {
  const raw: ProbeRaw = {
    models: ['alpha-model', 'DeepSeek-Flash', 'DeepSeek-Pro', 'stable'],
    toolCalling: true,
    jsonMode: false,
    fim: false,
    promptCaching: true,
    reasoningToggle: true,
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
    contextWindow: 32000
  };

  const report = buildCapabilityReport(raw);

  expect(report.useToolCalling).toBe(true);
  expect(report.useJsonMode).toBe(true);
  expect(report.useFim).toBe(true);
  expect(report.useCaching).toBe(true);
  expect(report.useReasoning).toBe(false);
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
    contextWindow: 65536
  };

  const report = buildCapabilityReport(raw);

  expect(report.contextWindow).toBe(raw.contextWindow);
});

it('buildCapabilityReport: maps deepseek-chat -> runner and deepseek-reasoner -> grader regardless of order', () => {
  const flags = {
    toolCalling: true,
    jsonMode: true,
    fim: false,
    promptCaching: true,
    reasoningToggle: true,
    streaming: false,
    contextWindow: 128_000
  };

  const inOrder = buildCapabilityReport({ models: ['deepseek-chat', 'deepseek-reasoner'], ...flags });
  expect(inOrder.runnerModel).toBe('deepseek-chat');
  expect(inOrder.graderModel).toBe('deepseek-reasoner');

  const reversed = buildCapabilityReport({ models: ['deepseek-reasoner', 'deepseek-chat'], ...flags });
  expect(reversed.runnerModel).toBe('deepseek-chat');
  expect(reversed.graderModel).toBe('deepseek-reasoner');
});

describe('live capability probe (GET /models)', () => {
  // Mirrors the real DeepSeek GET /models response (verified live 2026-06).
  const modelsBody = {
    object: 'list',
    data: [
      { id: 'deepseek-v4-flash', object: 'model', owned_by: 'deepseek' },
      { id: 'deepseek-v4-pro', object: 'model', owned_by: 'deepseek' }
    ]
  };

  it('fetchDeepSeekModels sends an authorized GET to <baseUrl>/models and returns model ids', async () => {
    const fetchSpy = vi.fn(async (_input: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => modelsBody
    }));

    const ids = await fetchDeepSeekModels({ apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com/', fetch: fetchSpy });

    expect(ids).toEqual(['deepseek-v4-flash', 'deepseek-v4-pro']);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.deepseek.com/models');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
  });

  it('fetchDeepSeekModels throws a clear error on a non-ok response', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));

    await expect(fetchDeepSeekModels({ apiKey: 'bad-key', fetch: fetchSpy })).rejects.toThrow(/401/);
  });

  it('probeDeepSeek returns ProbeRaw with live models and documented capability flags', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => modelsBody }));

    const raw = await probeDeepSeek({ apiKey: 'sk-test', fetch: fetchSpy });

    expect(raw.models).toEqual(['deepseek-v4-flash', 'deepseek-v4-pro']);
    expect(raw.fim).toBe(false);
    expect(raw.contextWindow).toBe(128_000);
  });

  it('probeAndWriteCapabilities performs a live probe when an apiKey is provided', async () => {
    const homeDir = '/tmp/bobby-live';
    let writtenContent = '';
    const mkdir = vi.fn(async () => undefined);
    const writeFile = vi.fn(async (_path: string, content: string) => {
      writtenContent = content;
    });
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => modelsBody }));

    await probeAndWriteCapabilities({ homeDir, mkdir, writeFile, apiKey: 'sk-test', fetch: fetchSpy });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(writtenContent);
    expect(parsed.runnerModel).toBe('deepseek-v4-flash');
    expect(parsed.graderModel).toBe('deepseek-v4-pro');
  });
});
