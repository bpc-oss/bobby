import { homedir } from 'node:os';
import { readFile as defaultReadFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DeepSeekModelClient } from './client';
import { FetchTransport } from './transport';
import type { CapabilityReport } from './probe';

export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

type ReadFile = (
  path: string,
  options?: Parameters<typeof defaultReadFile>[1]
) => ReturnType<typeof defaultReadFile>;

export interface DeepSeekLoadDeps {
  homeDir?: string;
  readFile?: ReadFile;
  baseUrl?: string;
}

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function parseCapabilities(raw: unknown): CapabilityReport {
  if (!raw || typeof raw !== 'object') {
    throw new Error('capabilities.json 必须是对象');
  }

  const candidate = raw as Partial<CapabilityReport>;
  const checks: Array<{ key: keyof CapabilityReport; predicate: (value: unknown) => boolean; expected: string }> = [
    { key: 'runnerModel', predicate: (v): v is string => typeof v === 'string' && v.trim().length > 0, expected: '非空字符串' },
    { key: 'graderModel', predicate: (v): v is string => typeof v === 'string' && v.trim().length > 0, expected: '非空字符串' },
    { key: 'useToolCalling', predicate: isBoolean, expected: 'boolean' },
    { key: 'useJsonMode', predicate: isBoolean, expected: 'boolean' },
    { key: 'useFim', predicate: isBoolean, expected: 'boolean' },
    { key: 'useCaching', predicate: isBoolean, expected: 'boolean' },
    { key: 'useReasoning', predicate: isBoolean, expected: 'boolean' },
    { key: 'contextWindow', predicate: isNumber, expected: 'number' }
  ];

  for (const check of checks) {
    if (!check.predicate((candidate as { [K in keyof CapabilityReport]: unknown })[check.key])) {
      throw new Error(`capabilities.json 中的 ${check.key} 无效，需要 ${check.expected}`);
    }
  }

  return {
    runnerModel: candidate.runnerModel!,
    graderModel: candidate.graderModel!,
    useToolCalling: candidate.useToolCalling!,
    useJsonMode: candidate.useJsonMode!,
    useFim: candidate.useFim!,
    useCaching: candidate.useCaching!,
    useReasoning: candidate.useReasoning!,
    contextWindow: candidate.contextWindow!
  };
}

function coerceText(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof Uint8Array || data instanceof Buffer) {
    return Buffer.from(data).toString('utf8');
  }

  throw new Error('读取文件失败：返回内容不是文本');
}

export async function loadDeepSeekConfig(deps: DeepSeekLoadDeps = {}): Promise<{
  apiKey: string;
  report: CapabilityReport;
}> {
  const homeDir = deps.homeDir ?? homedir();
  const readFile = deps.readFile ?? defaultReadFile;
  const keyPath = join(homeDir, '.bobby', 'key');
  const capabilitiesPath = join(homeDir, '.bobby', 'capabilities.json');

  const keyRaw = await readFile(keyPath, 'utf8').catch((error) => {
    const errno = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : undefined;
    if (errno === 'ENOENT') {
      throw new Error('未配置 DeepSeek Key，请先完成 M6 配置并写入 ~/.bobby/key');
    }
    throw error;
  });

  const capabilitiesRaw = await readFile(capabilitiesPath, 'utf8').catch((error) => {
    const errno = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : undefined;
    if (errno === 'ENOENT') {
      throw new Error('未配置 DeepSeek 能力文件，请先执行能力探针并生成 ~/.bobby/capabilities.json');
    }
    throw error;
  });

  const apiKey = coerceText(keyRaw).trim();
  if (!apiKey) {
    throw new Error('~/.bobby/key 为空，请写入 DeepSeek Key');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(coerceText(capabilitiesRaw));
  } catch {
    throw new Error('~/.bobby/capabilities.json 内容不是有效 JSON');
  }

  const report = parseCapabilities(parsed);

  return {
    apiKey,
    report
  };
}

export function makeDeepSeekClient(apiKey: string, report: CapabilityReport, baseUrl?: string): DeepSeekModelClient {
  return new DeepSeekModelClient({
    apiKey,
    report,
    transport: new FetchTransport({
      apiKey,
      baseUrl: baseUrl ?? DEFAULT_DEEPSEEK_BASE_URL
    })
  });
}

export async function makeDeepSeekClientFromBobbyConfig(deps: DeepSeekLoadDeps = {}): Promise<DeepSeekModelClient> {
  const { apiKey, report } = await loadDeepSeekConfig(deps);
  return makeDeepSeekClient(apiKey, report, deps.baseUrl);
}
