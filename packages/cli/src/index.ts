#!/usr/bin/env node
import {
  KernelHost,
  ToolRegistry,
  ToolEvidenceProvider,
  ExecTool,
  WriteFileTool,
  FileExistsTool,
  Workspace,
  VerificationEngine,
  CompletionGate,
  makeDeepSeekClientFromBobbyConfig,
  probeAndWriteCapabilities,
  CommandExitOracle,
  FileExistsOracle,
  FileDiffOracle,
  NoForbiddenPathChecker,
  type ConscienceDeps,
  type PlannedCall,
  type ModelClient
} from '@bobby/kernel';
import { runHeadless } from './headless';
import {
  canStartInteractive,
  runInteractiveSession,
  type InteractiveDeps,
  type InteractiveHandlers
} from './interactive';
import {
  getOnboardingStatus,
  isReadyForTasks,
  promptForDeepSeekKey,
  readDeepSeekKeyFromEnv,
  readSavedDeepSeekKey,
  renderOnboarding,
  saveDeepSeekKey,
  type OnboardingDeps
} from './onboarding';
import { realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
export type CliIO = {
  argv: string[];
  log: (msg: string) => void;
  exit: (code: number) => void | never;
};

export async function makeDefaultModel(): Promise<ModelClient> {
  return makeDeepSeekClientFromBobbyConfig();
}

type RunCliOptions = {
  makeModel?: () => Promise<ModelClient>;
  makeConscience?: () => ConscienceDeps;
  probe?: () => Promise<string>;
  onboarding?: OnboardingDeps;
  interactive?: InteractiveDeps;
  promptForKey?: () => Promise<string>;
};

const defaultConscience = (workspaceRoot = process.cwd()): ConscienceDeps => {
  const registry = new ToolRegistry();
  const ws = new Workspace(workspaceRoot);
  const provider = new ToolEvidenceProvider(registry);

  registry.register(new ExecTool(workspaceRoot));
  registry.register(new WriteFileTool(ws));
  registry.register(new FileExistsTool(ws));

  return {
    engine: new VerificationEngine([new CommandExitOracle(), new FileExistsOracle(), new FileDiffOracle()]),
    gate: new CompletionGate(),
    context: () => provider.context(),
    constraintCheckers: [new NoForbiddenPathChecker()],
    evidenceFor: (stepId: string, acIds: string[], calls?: ReadonlyArray<PlannedCall>) => {
      return provider.evidenceFor(stepId, acIds, calls);
    }
  };
};

function printOnboarding(io: CliIO, options: RunCliOptions, status = getOnboardingStatus(options.onboarding)): void {
  for (const line of renderOnboarding(status)) {
    io.log(line);
  }
}

function handleError(io: CliIO, err: unknown): void {
  if (err instanceof Error) {
    io.log(err.message);
    return;
  }
  io.log(String(err));
}

function shouldSkipSetupPreflight(options: RunCliOptions): boolean {
  return options.makeModel !== undefined;
}

function preflightTaskSetup(io: CliIO, options: RunCliOptions): boolean {
  if (shouldSkipSetupPreflight(options)) {
    return true;
  }

  const status = getOnboardingStatus(options.onboarding);
  if (isReadyForTasks(status)) {
    return true;
  }

  printOnboarding(io, options, status);
  return false;
}

async function runCommand(io: CliIO, args: string[], options: RunCliOptions): Promise<void> {
  const task = args.join(' ').trim();
  if (!task) {
    printOnboarding(io, options);
    io.exit(1);
    return;
  }

  if (!preflightTaskSetup(io, options)) {
    io.exit(1);
    return;
  }

  try {
    const model = await (options.makeModel ?? makeDefaultModel)();
    const conscience = (options.makeConscience ?? defaultConscience)();
    const host = new KernelHost(() => model, conscience);
    const result = await runHeadless(host, task, io.log);
    io.exit(result.exitCode);
  } catch (err) {
    handleError(io, err);
    io.exit(1);
  }
}

async function runWithoutProcessExit(
  io: CliIO,
  action: (safeIo: CliIO) => Promise<void>
): Promise<number> {
  let exitCode = 0;
  await action({
    ...io,
    exit: (code) => {
      exitCode = code;
    }
  });
  return exitCode;
}

function printInteractiveHelp(io: CliIO): void {
  io.log('Interactive commands');
  io.log('  <task>    Run a natural-language task in this directory');
  io.log('  /status   Show Bobby setup status');
  io.log('  /probe    Refresh the DeepSeek capability report');
  io.log('  /help     Show this help');
  io.log('  /exit     Quit');
}

async function interactiveCommand(io: CliIO, options: RunCliOptions): Promise<void> {
  if (!preflightTaskSetup(io, options)) {
    io.exit(1);
    return;
  }

  const handlers: InteractiveHandlers = {
    runTask: async (task) => runWithoutProcessExit(io, (safeIo) => runCommand(safeIo, [task], options)),
    createHost: async () => {
      const model = await (options.makeModel ?? makeDefaultModel)();
      const conscience = (options.makeConscience ?? defaultConscience)();
      return new KernelHost(() => model, conscience);
    },
    printHelp: () => printInteractiveHelp(io),
    printStatus: () => printOnboarding(io, options),
    probe: async () => runWithoutProcessExit(io, (safeIo) => probeCommand(safeIo, options))
  };

  try {
    await runInteractiveSession(io, handlers, options.interactive);
  } catch (err) {
    handleError(io, err);
    io.exit(1);
  }
}

function resolveProbeApiKey(options: RunCliOptions): string | undefined {
  return readDeepSeekKeyFromEnv(options.onboarding) ?? readSavedDeepSeekKey(options.onboarding);
}

async function probeCommand(io: CliIO, options: RunCliOptions): Promise<void> {
  try {
    const runProbe =
      options.probe ?? (() => probeAndWriteCapabilities({ apiKey: resolveProbeApiKey(options) }));
    const reportPath = await runProbe();
    io.log(`DeepSeek capability report written to: ${reportPath}`);
  } catch (err) {
    handleError(io, err);
    io.exit(1);
  }
}

async function loginCommand(io: CliIO, args: string[], options: RunCliOptions): Promise<void> {
  const supportedFlags = new Set(['--from-env', '--skip-probe']);
  const unknownFlags = args.filter((arg) => !supportedFlags.has(arg));
  if (unknownFlags.length > 0) {
    io.log(`Unknown login option: ${unknownFlags.join(' ')}`);
    io.log('Usage: bobby login [--from-env] [--skip-probe]');
    io.exit(1);
    return;
  }

  const fromEnv = args.includes('--from-env');
  const skipProbe = args.includes('--skip-probe');

  try {
    const apiKey = fromEnv
      ? readDeepSeekKeyFromEnv(options.onboarding)
      : await (options.promptForKey ?? (() => promptForDeepSeekKey(options.onboarding)))();

    if (!apiKey) {
      io.log('DEEPSEEK_API_KEY was not found. Run bobby login and paste your key, or set it first.');
      io.exit(1);
      return;
    }

    const keyPath = saveDeepSeekKey(apiKey, options.onboarding);
    io.log(`DeepSeek key saved to: ${keyPath}`);

    if (skipProbe) {
      io.log('Skipped capability probe. Run bobby probe before the first task.');
      return;
    }

    const runProbe = options.probe ?? (() => probeAndWriteCapabilities({ apiKey }));
    const reportPath = await runProbe();
    io.log(`Capability report written to: ${reportPath}`);
    io.log('Bobby is ready. Try: bobby run "Create hello.txt with exactly hi, then verify with cmd /c type hello.txt"');
  } catch (err) {
    handleError(io, err);
    io.exit(1);
  }
}

function unsupportedCommand(io: CliIO, cmd: string): void {
  io.log(`Unknown command: ${cmd}`);
  io.log('Supported commands: login, run, interactive, probe, help');
  io.exit(1);
}

export async function runCli(io: CliIO, options: RunCliOptions = {}): Promise<void> {
  const [cmd, ...args] = io.argv;

  if (!cmd) {
    const status = getOnboardingStatus(options.onboarding);
    if (isReadyForTasks(status) && canStartInteractive(options.interactive)) {
      await interactiveCommand(io, options);
      return;
    }

    printOnboarding(io, options, status);
    return;
  }

  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printOnboarding(io, options);
    return;
  }

  if (cmd === 'login') {
    await loginCommand(io, args, options);
    return;
  }

  if (cmd === 'run') {
    await runCommand(io, args, options);
    return;
  }

  if (cmd === 'interactive') {
    await interactiveCommand(io, options);
    return;
  }

  if (cmd === 'probe') {
    await probeCommand(io, options);
    return;
  }

  unsupportedCommand(io, cmd);
}

export function isCliEntrypoint(argvPath: string | undefined, moduleUrl = import.meta.url): boolean {
  if (!argvPath) {
    return false;
  }

  try {
    return realpathSync(argvPath) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return moduleUrl === pathToFileURL(argvPath).href;
  }
}

if (isCliEntrypoint(process.argv[1])) {
  void runCli({
    argv: process.argv.slice(2),
    log: console.log,
    exit: process.exit
  });
}
