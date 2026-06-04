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
  contextWindow: number;
}

type Mkdir = (path: string, options?: { recursive?: boolean }) => Promise<unknown>;
type WriteFile = (file: string, data: string, encoding?: BufferEncoding) => Promise<void>;

export interface ProbeWriteDeps {
  homeDir?: string;
  mkdir?: Mkdir;
  writeFile?: WriteFile;
}

export function defaultDeepSeekProbeRaw(): ProbeRaw {
  return {
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    toolCalling: true,
    jsonMode: true,
    fim: false,
    promptCaching: true,
    reasoningToggle: true,
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
  const raw = defaultDeepSeekProbeRaw();
  const report = buildCapabilityReport(raw);
  return writeCapabilityReport(report, deps);
}
