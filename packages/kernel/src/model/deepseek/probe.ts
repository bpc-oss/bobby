import { homedir } from 'node:os';
import { mkdir as defaultMkdir, readFile as defaultReadFile, writeFile as defaultWriteFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ProbeRaw {
  models: string[];
  toolCalling: boolean;
  jsonMode: boolean;
  fim: boolean;
  promptCaching: boolean;
  reasoningToggle: boolean;
  visionToggle: boolean;
  streaming?: boolean;
  contextWindow: number;
}

export interface CapabilityReport {
  runnerModel: string;
  graderModel: string;
  useToolCalling: boolean;
  useJsonMode: boolean;
  useFim: boolean;
  useCaching: boolean;
  useReasoning: boolean;
  useVision: boolean;
  useStreaming: boolean;
  contextWindow: number;
}

type Mkdir = (path: string, options?: { recursive?: boolean }) => Promise<unknown>;
type WriteFile = (file: string, data: string, encoding?: BufferEncoding) => Promise<void>;

export interface ProbeWriteDeps {
  homeDir?: string;
  mkdir?: Mkdir;
  readFile?: (path: string, encoding: BufferEncoding) => Promise<string>;
  writeFile?: WriteFile;
  fetch?: typeof fetch;
  baseUrl?: string;
}

export function defaultDeepSeekProbeRaw(): ProbeRaw {
  return {
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    toolCalling: true,
    jsonMode: true,
    fim: false,
    promptCaching: true,
    reasoningToggle: true,
    visionToggle: false,
    streaming: false,
    contextWindow: 1_000_000
  };
}

const DEFAULT_CHAT_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'];

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function resolveBetaBaseUrl(baseUrl: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized.endsWith('/beta') ? normalized : `${normalized}/beta`;
}

async function readTextOrNull(path: string, readFile: (path: string, encoding: BufferEncoding) => Promise<string>): Promise<string | null> {
  try {
    return (await readFile(path, 'utf8')).trim();
  } catch (error) {
    const errno = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : undefined;
    if (errno === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function requestJson(
  fetchImpl: typeof fetch,
  url: string,
  apiKey: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; json: unknown; contentType: string }> {
  const response = await fetchImpl(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const contentType = response.headers.get('content-type') ?? '';
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    json,
    contentType
  };
}

async function requestText(
  fetchImpl: typeof fetch,
  url: string,
  apiKey: string,
  body: unknown
): Promise<{ ok: boolean; status: number; contentType: string; body: string }> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const contentType = response.headers.get('content-type') ?? '';
  const bodyText = await response.text().catch(() => '');

  return {
    ok: response.ok,
    status: response.status,
    contentType,
    body: bodyText
  };
}

function parseModels(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { data?: unknown }).data)) {
    return [...DEFAULT_CHAT_MODELS];
  }

  const models = ((raw as { data: Array<{ id?: unknown }> }).data)
    .map((entry) => (typeof entry?.id === 'string' ? entry.id : ''))
    .filter((value): value is string => value.length > 0);

  return models.length > 0 ? models : [...DEFAULT_CHAT_MODELS];
}

async function probeVisionSupport(fetchImpl: typeof fetch, baseUrl: string, apiKey: string, model: string): Promise<boolean> {
  const response = await requestJson(fetchImpl, `${normalizeBaseUrl(baseUrl)}/chat/completions`, apiKey, {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image.' },
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAA' +
                'AAC0lEQVR42mP8/x8AAwMCAO+/X+0AAAAASUVORK5CYII='
            }
          }
        ]
      }
    ],
    stream: false
  });

  return response.ok;
}

async function probeStreamingSupport(fetchImpl: typeof fetch, baseUrl: string, apiKey: string, model: string): Promise<boolean> {
  const response = await requestText(fetchImpl, `${normalizeBaseUrl(baseUrl)}/chat/completions`, apiKey, {
    model,
    messages: [{ role: 'user', content: 'Reply with OK.' }],
    stream: true
  });

  return response.ok && (response.contentType.includes('text/event-stream') || response.body.includes('[DONE]') || response.body.includes('data:'));
}

async function probeJsonSupport(fetchImpl: typeof fetch, baseUrl: string, apiKey: string, model: string): Promise<boolean> {
  const response = await requestJson(fetchImpl, `${normalizeBaseUrl(baseUrl)}/chat/completions`, apiKey, {
    model,
    messages: [{ role: 'user', content: 'Reply with a JSON object.' }],
    response_format: { type: 'json_object' },
    stream: false
  });

  return response.ok;
}

async function probeToolCallingSupport(fetchImpl: typeof fetch, baseUrl: string, apiKey: string, model: string): Promise<boolean> {
  const response = await requestJson(fetchImpl, `${normalizeBaseUrl(baseUrl)}/chat/completions`, apiKey, {
    model,
    messages: [{ role: 'user', content: 'Use the available tool if you need it.' }],
    tools: [
      {
        type: 'function',
        function: {
          name: 'probe_tool',
          description: 'Probe whether tool calling is accepted.',
          parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        }
      }
    ],
    stream: false
  });

  return response.ok;
}

async function probeReasoningSupport(fetchImpl: typeof fetch, baseUrl: string, apiKey: string, model: string): Promise<boolean> {
  const response = await requestJson(fetchImpl, `${normalizeBaseUrl(baseUrl)}/chat/completions`, apiKey, {
    model,
    messages: [{ role: 'user', content: 'Respond briefly.' }],
    thinking: { type: 'enabled' },
    stream: false
  });

  return response.ok;
}

async function probeFimSupport(fetchImpl: typeof fetch, betaBaseUrl: string, apiKey: string, model: string): Promise<boolean> {
  const response = await requestJson(fetchImpl, `${normalizeBaseUrl(betaBaseUrl)}/completions`, apiKey, {
    model,
    prompt: 'function add(a, b) {',
    echo: false
  });

  return response.ok;
}

export async function probeDeepSeekCapabilities(deps: {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}): Promise<ProbeRaw> {
  const fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = normalizeBaseUrl(deps.baseUrl ?? 'https://api.deepseek.com');
  const betaBaseUrl = resolveBetaBaseUrl(baseUrl);

  const modelsResponse = await requestJson(fetchImpl, `${baseUrl}/models`, deps.apiKey);
  if (!modelsResponse.ok) {
    throw new Error(`DeepSeek capability probe failed with status ${modelsResponse.status}`);
  }
  const models = parseModels(modelsResponse.json);
  const runnerModel = models.find((model) => /flash/i.test(model)) ?? models[0] ?? DEFAULT_CHAT_MODELS[0];
  const graderModel = models.find((model) => /pro/i.test(model)) ?? models[1] ?? runnerModel;

  return {
    models: models.length > 0 ? models : [...DEFAULT_CHAT_MODELS],
    toolCalling: await probeToolCallingSupport(fetchImpl, baseUrl, deps.apiKey, graderModel),
    jsonMode: await probeJsonSupport(fetchImpl, baseUrl, deps.apiKey, graderModel),
    fim: await probeFimSupport(fetchImpl, betaBaseUrl, deps.apiKey, graderModel),
    promptCaching: true,
    reasoningToggle: await probeReasoningSupport(fetchImpl, baseUrl, deps.apiKey, graderModel),
    visionToggle: await probeVisionSupport(fetchImpl, baseUrl, deps.apiKey, runnerModel),
    streaming: await probeStreamingSupport(fetchImpl, baseUrl, deps.apiKey, runnerModel),
    contextWindow: 1_000_000
  };
}

export function buildCapabilityReport(raw: ProbeRaw): CapabilityReport {
  if (raw.models.length < 1) {
    throw new Error('ProbeRaw models must contain at least one model.');
  }

  const runnerModel = raw.models.find((model) => /flash/i.test(model)) ?? raw.models[0];
  const graderModel = raw.models.find((model) => /pro/i.test(model)) ?? raw.models[1] ?? runnerModel;

  return {
    runnerModel,
    graderModel,
    useToolCalling: raw.toolCalling,
    useJsonMode: raw.jsonMode,
    useFim: raw.fim,
    useCaching: raw.promptCaching,
    useReasoning: raw.reasoningToggle,
    useVision: raw.visionToggle,
    useStreaming: raw.streaming === true,
    contextWindow: raw.contextWindow
  };
}

export async function writeCapabilityReport(
  report: CapabilityReport,
  deps: ProbeWriteDeps = {}
): Promise<string> {
  const homeDir = deps.homeDir ?? homedir();
  const mkdir = deps.mkdir ?? defaultMkdir;
  const writeFile = deps.writeFile ?? defaultWriteFile;
  const capabilitiesPath = join(homeDir, '.bobby', 'capabilities.json');

  await mkdir(join(homeDir, '.bobby'), { recursive: true });
  await writeFile(capabilitiesPath, JSON.stringify(report, null, 2), 'utf8');

  return capabilitiesPath;
}

export async function probeAndWriteCapabilities(deps: ProbeWriteDeps = {}): Promise<string> {
  const homeDir = deps.homeDir ?? homedir();
  const readFile = deps.readFile ?? defaultReadFile;
  const keyPath = join(homeDir, '.bobby', 'key');
  const apiKey = await readTextOrNull(keyPath, readFile);
  const raw = apiKey
    ? await probeDeepSeekCapabilities({
        apiKey,
        baseUrl: deps.baseUrl,
        fetch: deps.fetch
      })
    : defaultDeepSeekProbeRaw();
  const report = buildCapabilityReport(raw);
  return writeCapabilityReport(report, { ...deps, homeDir });
}
