import { expect, it } from 'vitest';

import { buildCapabilityReport, type ProbeRaw } from '../src/model/deepseek/probe';

it('buildCapabilityReport: uses flash and pro models when present and maps specific capability flags', () => {
  const raw: ProbeRaw = {
    models: ['alpha-model', 'DeepSeek-Flash', 'DeepSeek-Pro', 'stable'],
    toolCalling: true,
    jsonMode: false,
    fim: false,
    promptCaching: true,
    reasoningToggle: true,
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
