import { execFileSync as defaultExecFileSync } from 'node:child_process';
import {
  existsSync as defaultExistsSync,
  mkdirSync as defaultMkdirSync,
  readFileSync as defaultReadFileSync,
  writeFileSync as defaultWriteFileSync
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { stdin as defaultStdin, stdout as defaultStdout } from 'node:process';

const deepSeekEnvKey = 'DEEPSEEK_API_KEY';

type ExistsSync = (path: string) => boolean;
type ReadFileSync = (path: string, encoding: BufferEncoding) => string;
type MkdirSync = (path: string, options?: { recursive?: boolean }) => unknown;
type WriteFileSync = (
  path: string,
  data: string,
  options?: { encoding?: BufferEncoding; mode?: number }
) => void;
type ExecFileSync = (
  file: string,
  args: string[],
  options: { encoding: BufferEncoding; stdio: ['ignore', 'pipe', 'ignore'] }
) => string;

type PromptInput = NodeJS.ReadStream & {
  isRaw?: boolean;
  setRawMode?: (mode: boolean) => unknown;
};

type PromptOutput = NodeJS.WriteStream;

type PromptSession = {
  input: PromptInput;
  output: PromptOutput;
  wasRaw: boolean;
  value: string;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  onData?: (chunk: Buffer) => void;
};

export type OnboardingDeps = {
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
  existsSync?: ExistsSync;
  readFileSync?: ReadFileSync;
  mkdirSync?: MkdirSync;
  writeFileSync?: WriteFileSync;
  execFileSync?: ExecFileSync;
  stdin?: PromptInput;
  stdout?: PromptOutput;
};

export type OnboardingStatus = {
  homeDir: string;
  bobbyDir: string;
  keyPath: string;
  capabilitiesPath: string;
  hasKey: boolean;
  hasCapabilities: boolean;
  hasEnvKey: boolean;
};

function getPaths(homeDir: string): Pick<OnboardingStatus, 'bobbyDir' | 'keyPath' | 'capabilitiesPath'> {
  const bobbyDir = join(homeDir, '.bobby');
  return {
    bobbyDir,
    keyPath: join(bobbyDir, 'key'),
    capabilitiesPath: join(bobbyDir, 'capabilities.json')
  };
}

function fileHasText(path: string, existsSync: ExistsSync, readFileSync: ReadFileSync): boolean {
  if (!existsSync(path)) {
    return false;
  }

  return readFileSync(path, 'utf8').trim().length > 0;
}

function readWindowsEnvKey(execFileSync: ExecFileSync): string | undefined {
  if (process.platform !== 'win32') {
    return undefined;
  }

  for (const target of ['User', 'Machine']) {
    const script = `[Environment]::GetEnvironmentVariable('${deepSeekEnvKey}','${target}')`;
    const value = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();

    if (value.length > 0) {
      return value;
    }
  }

  return undefined;
}

export function readDeepSeekKeyFromEnv(deps: OnboardingDeps = {}): string | undefined {
  const env = deps.env ?? process.env;
  const currentValue = env[deepSeekEnvKey]?.trim();
  if (currentValue) {
    return currentValue;
  }

  try {
    return readWindowsEnvKey(deps.execFileSync ?? defaultExecFileSync);
  } catch {
    return undefined;
  }
}

export function readSavedDeepSeekKey(deps: OnboardingDeps = {}): string | undefined {
  const homeDir = deps.homeDir ?? homedir();
  const paths = getPaths(homeDir);
  const existsSync = deps.existsSync ?? defaultExistsSync;
  const readFileSync = deps.readFileSync ?? defaultReadFileSync;

  if (!existsSync(paths.keyPath)) {
    return undefined;
  }

  const value = readFileSync(paths.keyPath, 'utf8').trim();
  return value.length > 0 ? value : undefined;
}

export function getOnboardingStatus(deps: OnboardingDeps = {}): OnboardingStatus {
  const homeDir = deps.homeDir ?? homedir();
  const paths = getPaths(homeDir);
  const existsSync = deps.existsSync ?? defaultExistsSync;
  const readFileSync = deps.readFileSync ?? defaultReadFileSync;

  return {
    homeDir,
    ...paths,
    hasKey: fileHasText(paths.keyPath, existsSync, readFileSync),
    hasCapabilities: fileHasText(paths.capabilitiesPath, existsSync, readFileSync),
    hasEnvKey: readDeepSeekKeyFromEnv(deps) !== undefined
  };
}

export function isReadyForTasks(status: OnboardingStatus): boolean {
  return status.hasKey && status.hasCapabilities;
}

export function renderOnboarding(status: OnboardingStatus): string[] {
  const keyState = status.hasKey ? '[ready]' : '[setup]';
  const capabilitiesState = status.hasCapabilities ? '[ready]' : '[setup]';
  const nextSteps = status.hasKey
    ? status.hasCapabilities
      ? ['  bobby', '  bobby run "Create hello.txt with exactly hi, then verify with cmd /c type hello.txt"']
      : ['  1. bobby probe', '  2. bobby']
    : [
        status.hasEnvKey ? '  1. bobby login --from-env' : '  1. bobby login',
        '  2. bobby'
      ];

  return [
    'Bobby',
    '',
    'Local coding agent with evidence gates.',
    '',
    'Status',
    `${keyState} DeepSeek key: ${status.hasKey ? 'configured' : 'missing'} (~/.bobby/key)`,
    `${capabilitiesState} Capability probe: ${status.hasCapabilities ? 'ready' : 'missing'} (~/.bobby/capabilities.json)`,
    '',
    'Start',
    ...nextSteps,
    '',
    'Commands',
    '  bobby                 Start interactive mode',
    '  bobby login           Configure your DeepSeek key locally',
    status.hasEnvKey ? '  bobby login --from-env Import DEEPSEEK_API_KEY from environment' : undefined,
    '  bobby probe           Refresh the DeepSeek capability report',
    '  bobby run "<task>"    Execute a task with evidence checks',
    '  bobby help            Show this screen'
  ].filter((line): line is string => typeof line === 'string');
}

export function saveDeepSeekKey(apiKey: string, deps: OnboardingDeps = {}): string {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error('DeepSeek key is empty.');
  }

  const homeDir = deps.homeDir ?? homedir();
  const paths = getPaths(homeDir);
  const mkdirSync = deps.mkdirSync ?? defaultMkdirSync;
  const writeFileSync = deps.writeFileSync ?? defaultWriteFileSync;

  mkdirSync(paths.bobbyDir, { recursive: true });
  writeFileSync(paths.keyPath, `${trimmed}\n`, { encoding: 'utf8', mode: 0o600 });

  return paths.keyPath;
}

function cleanupPrompt(session: PromptSession): void {
  if (session.onData) {
    session.input.off('data', session.onData);
  }
  session.input.setRawMode?.(session.wasRaw);
  session.output.write('\n');
}

function finishPrompt(session: PromptSession): void {
  cleanupPrompt(session);
  session.resolve(session.value);
}

function cancelPrompt(session: PromptSession): void {
  cleanupPrompt(session);
  session.reject(new Error('Login cancelled.'));
}

function handlePromptByte(session: PromptSession, byte: number): boolean {
  if (byte === 3) {
    cancelPrompt(session);
    return true;
  }

  if (byte === 13 || byte === 10) {
    finishPrompt(session);
    return true;
  }

  if (byte === 8 || byte === 127) {
    if (session.value.length > 0) {
      session.value = session.value.slice(0, -1);
      session.output.write('\b \b');
    }
    return false;
  }

  if (byte >= 32 && byte <= 126) {
    session.value += String.fromCharCode(byte);
    session.output.write('*');
  }

  return false;
}

function createPromptDataHandler(session: PromptSession): (chunk: Buffer) => void {
  return (chunk: Buffer): void => {
    for (const byte of chunk) {
      if (handlePromptByte(session, byte)) {
        return;
      }
    }
  };
}

export async function promptForDeepSeekKey(deps: OnboardingDeps = {}): Promise<string> {
  const input = deps.stdin ?? defaultStdin;
  const output = deps.stdout ?? defaultStdout;

  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error(`Interactive login requires a TTY. Set ${deepSeekEnvKey}, then run bobby login --from-env.`);
  }

  return new Promise((resolve, reject) => {
    const session: PromptSession = {
      input,
      output,
      wasRaw: input.isRaw === true,
      value: '',
      resolve,
      reject
    };
    const onData = createPromptDataHandler(session);
    session.onData = onData;

    output.write('Paste your DeepSeek API key: ');
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}
