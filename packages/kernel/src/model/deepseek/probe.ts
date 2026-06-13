import { homedir } from 'node:os';
import { mkdir as defaultMkdir, writeFile as defaultWriteFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ProbeRaw {
  models: string[];
  toolCalling: boolean;
  jsonMode: boolean;
  fim: boolean;
  promptCaching: boolean;
  reasoningToggle: boolean;
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
  useStreaming: boolean;
  contextWindow: number;
}

type Mkdir = (path: string, options?: { recursive?: boolean }) => Promise<unknown>;
type WriteFile = (file: string, data: string, encoding?: BufferEncoding) => Promise<void>;

export const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com';

// Capability flags are documented platform features of DeepSeek (account-independent),
// not discoverable from the `/models` listing — so they are pinned here from the docs.
// Only the model ids are probed live. FIM/streaming stay off until verified end-to-end.
const DOCUMENTED_CAPABILITY_FLAGS = {
  toolCalling: true,
  jsonMode: true,
  fim: false,
  promptCaching: true,
  reasoningToggle: true,
  streaming: false,
  contextWindow: 128_000
} as const;

type ProbeFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type ProbeFetchFn = (input: string, init?: RequestInit) => Promise<ProbeFetchResponse>;

export interface DeepSeekProbeHttpDeps {
  apiKey: string;
  baseUrl?: string;
  fetch?: ProbeFetchFn;
}

interface DeepSeekModelsResponse {
  object?: unknown;
  data?: Array<{ id?: unknown }>;
}

interface DeepSeekToolCallResponse {
  choices?: Array<{
    message?: {
      tool_calls?: Array<{
        function?: {
          name?: unknown;
          arguments?: unknown;
        };
      }>;
    };
  }>;
}

export interface ProbeWriteDeps {
  homeDir?: string;
  mkdir?: Mkdir;
  writeFile?: WriteFile;
  // When apiKey is provided, capabilities are probed against the live API instead of defaults.
  apiKey?: string;
  baseUrl?: string;
  fetch?: ProbeFetchFn;
}

// Offline fallback used only when no API key is available. Verified 2026-06 against
// the live `GET /models` endpoint, which returns exactly these two ids. When a key is
// present we always derive the model list live instead of trusting this fallback
// (see probeDeepSeek), so the model ids are never a guess on the real path.
export function defaultDeepSeekProbeRaw(): ProbeRaw {
  return {
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    ...DOCUMENTED_CAPABILITY_FLAGS
  };
}

export function buildCapabilityReport(raw: ProbeRaw): CapabilityReport {
  if (raw.models.length < 1) {
    throw new Error('ProbeRaw models must contain at least one model.');
  }

  // runner = the cheaper/non-reasoning model (DeepSeek "chat", or a "flash" tier);
  // grader = the reasoning model (DeepSeek "reasoner", or a "pro" tier). Order-independent.
  const runnerModel = raw.models.find((model) => /flash|chat/i.test(model)) ?? raw.models[0];
  const graderModel =
    raw.models.find((model) => /pro|reasoner/i.test(model)) ?? raw.models[1] ?? runnerModel;

  return {
    runnerModel,
    graderModel,
    useToolCalling: raw.toolCalling,
    useJsonMode: raw.jsonMode,
    useFim: raw.fim,
    useCaching: raw.promptCaching,
    useReasoning: raw.reasoningToggle,
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

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function selectRunnerModel(models: string[]): string {
  return models.find((model) => /flash|chat/i.test(model)) ?? models[0] ?? '';
}

function buildToolCallingProbeBody(model: string): string {
  return JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'Call the probe tool.' }],
    tools: [
      {
        type: 'function',
        function: {
          name: 'probe_echo',
          description: 'Probe whether the model can return a tool call.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      }
    ],
    stream: false
  });
}

async function probeToolCallingWithModel(deps: DeepSeekProbeHttpDeps, model: string): Promise<boolean> {
  const baseUrl = normalizeBaseUrl(deps.baseUrl ?? DEEPSEEK_DEFAULT_BASE_URL);
  const doFetch = deps.fetch ?? (globalThis.fetch.bind(globalThis) as ProbeFetchFn);

  const response = await doFetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${deps.apiKey}`
    },
    body: buildToolCallingProbeBody(model)
  });

  if (!response.ok) {
    return false;
  }

  const body = (await response.json()) as DeepSeekToolCallResponse;
  return Array.isArray(body.choices?.[0]?.message?.tool_calls) && body.choices[0].message.tool_calls.length > 0;
}

// Lists the models the account can actually use, via the OpenAI-compatible
// `GET /models` endpoint. This is the source of truth for model ids — we never
// hardcode a guessed name when a key is available.
export async function fetchDeepSeekModels(deps: DeepSeekProbeHttpDeps): Promise<string[]> {
  const baseUrl = normalizeBaseUrl(deps.baseUrl ?? DEEPSEEK_DEFAULT_BASE_URL);
  const doFetch = deps.fetch ?? (globalThis.fetch.bind(globalThis) as ProbeFetchFn);

  const response = await doFetch(`${baseUrl}/models`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${deps.apiKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`DeepSeek /models request failed with status ${response.status}`);
  }

  const body = (await response.json()) as DeepSeekModelsResponse;
  const ids = (body.data ?? [])
    .map((entry) => (typeof entry.id === 'string' ? entry.id : ''))
    .filter((id) => id.length > 0);

  if (ids.length === 0) {
    throw new Error('DeepSeek /models returned no usable model ids');
  }

  return ids;
}

export async function probeToolCalling(deps: DeepSeekProbeHttpDeps): Promise<boolean> {
  const models = await fetchDeepSeekModels(deps);
  return probeToolCallingWithModel(deps, selectRunnerModel(models));
}

export async function probeDeepSeek(deps: DeepSeekProbeHttpDeps): Promise<ProbeRaw> {
  const models = await fetchDeepSeekModels(deps);
  return {
    models,
    ...DOCUMENTED_CAPABILITY_FLAGS,
    toolCalling: await probeToolCallingWithModel(deps, selectRunnerModel(models))
  };
}

export async function probeAndWriteCapabilities(deps: ProbeWriteDeps = {}): Promise<string> {
  const raw = deps.apiKey
    ? await probeDeepSeek({ apiKey: deps.apiKey, baseUrl: deps.baseUrl, fetch: deps.fetch })
    : defaultDeepSeekProbeRaw();
  const report = buildCapabilityReport(raw);
  return writeCapabilityReport(report, deps);
}
