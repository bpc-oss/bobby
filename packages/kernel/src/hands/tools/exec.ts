import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

import type { Evidence } from '@bobby/shared';
import type { Tool, ToolResult } from '../tool';
import { Workspace } from '../workspace';

export interface ExecInput {
  cmd: string;
  args?: string[];
  timeoutMs?: number;
}

interface ParsedCommand {
  cmd: string;
  args: string[];
  mkdirDirectory?: string;
}

export class ExecTool implements Tool {
  readonly name = 'exec';
  readonly permissionTier = 'L2' as const;
  private readonly workspace: Workspace;

  constructor(cwdOrWorkspace: string | Workspace) {
    this.workspace = cwdOrWorkspace instanceof Workspace ? cwdOrWorkspace : new Workspace(cwdOrWorkspace);
  }

  async run(
    input: Record<string, unknown>,
    ctx: { acId: string; claimId: string }
  ): Promise<ToolResult> {
    const parsed = this.parseInput(input);

    if (parsed.mkdirDirectory) {
      const evidence = await this.handleMkdirCommand(parsed.mkdirDirectory, ctx);
      return {
        evidence: [evidence],
        result: { exitCode: 0 }
      };
    }

    const { cmd, args, timeoutMs } = parsed;
    const outputs = await this.spawnCommand(cmd, args, timeoutMs);

    const payload: Record<string, unknown> = {
      cmd,
      args,
      exitCode: outputs.exitCode,
      stdout: outputs.stdout,
      stderr: outputs.stderr,
      signal: outputs.signal,
      timedOut: outputs.timedOut
    };
    if (outputs.spawnError !== undefined) {
      payload.spawnError = outputs.spawnError;
    }

    const evidence: Evidence = {
      claimId: ctx.claimId,
      acId: ctx.acId,
      evidenceType: 'command_output',
      payload,
      producedBy: 'tool'
    };

    return {
      evidence: [evidence],
      result: { exitCode: outputs.exitCode }
    };
  }

  private parseInput(input: Record<string, unknown>): {
    cmd: string;
    args: string[];
    timeoutMs: number;
    mkdirDirectory?: string;
  } {
    if (typeof input !== 'object' || input === null) {
      throw new Error('ExecTool input must be an object');
    }

    const hasCmd = typeof input?.cmd === 'string';
    const hasCommand = typeof input?.command === 'string';

    if (!hasCmd && !hasCommand) {
      throw new Error('ExecTool input must include cmd string or command string');
    }

    if (hasCmd && hasCommand) {
      throw new Error('ExecTool input must not include both cmd and command');
    }

    if (hasCmd) {
      const { cmd, args, mkdirDirectory } = this.parseCanonical(input);
      return {
        cmd,
        args,
        timeoutMs: this.parseTimeout(input.timeoutMs),
        mkdirDirectory
      };
    }

    if (!hasCommand) {
      throw new Error('ExecTool input must include cmd string or command string');
    }

    const { cmd, args, mkdirDirectory } = this.parseLegacy(input);
    return {
      cmd,
      args,
      mkdirDirectory,
      timeoutMs: this.parseTimeout(input.timeoutMs)
    };
  }

  private parseCanonical(input: Record<string, unknown>): ParsedCommand {
    const rawCmd = input.cmd;
    const rawArgs = input.args;

    if (typeof rawCmd !== 'string') {
      throw new Error('ExecTool input cmd must be a string');
    }

    if (rawArgs !== undefined && !Array.isArray(rawArgs)) {
      throw new Error('ExecTool input args must be an array of strings');
    }

    const sanitizedArgs = Array.isArray(rawArgs) ? rawArgs : [];
    if (!sanitizedArgs.every((arg) => typeof arg === 'string')) {
      throw new Error('ExecTool input args must be an array of strings');
    }

    const parsed = {
      cmd: rawCmd,
      args: sanitizedArgs
    };
    const mkdirDirectory = this.parseMkdirDirectory(parsed);

    return {
      ...parsed,
      mkdirDirectory
    };
  }

  private parseLegacy(input: Record<string, unknown>): ParsedCommand {
    const rawCommand = input.command;
    if (typeof rawCommand !== 'string') {
      throw new Error('ExecTool input command must be a string');
    }

    if (input.args !== undefined) {
      throw new Error('ExecTool input command alias cannot include args');
    }

    const parsed = this.parseCommandString(rawCommand);
    const mkdirDirectory = this.parseMkdirDirectory(parsed);

    return {
      cmd: parsed.cmd,
      args: parsed.args,
      mkdirDirectory
    };
  }

  private parseMkdirDirectory(parsed: { cmd: string; args: string[] }): string | undefined {
    if (parsed.cmd !== 'mkdir') {
      return undefined;
    }

    if (parsed.args.length === 1 && parsed.args[0] !== '' && !parsed.args[0].startsWith('-')) {
      return parsed.args[0];
    }

    if (parsed.args.length === 2 && parsed.args[0] === '-p' && !parsed.args[1].startsWith('-')) {
      return parsed.args[1];
    }

    return undefined;
  }

  private parseTimeout(value: unknown): number {
    const timeoutMs = value === undefined ? 60000 : value;
    if (typeof timeoutMs !== 'number') {
      throw new Error('ExecTool input timeoutMs must be a number');
    }

    return timeoutMs;
  }

  private parseCommandString(raw: string): { cmd: string; args: string[] } {
    if (!raw.trim()) {
      throw new Error('ExecTool input command must be a non-empty string');
    }

    const tokens = this.tokenizeCommand(raw);
    const [cmd, ...args] = tokens;
    if (!cmd) {
      throw new Error('ExecTool input command must include an executable');
    }

    return { cmd, args };
  }

  private tokenizeCommand(raw: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let quote: '\'' | '"' | null = null;

    for (let i = 0; i < raw.length; i += 1) {
      const char = raw[i];

      if (quote) {
        if (char === quote) {
          quote = null;
        } else {
          current += char;
        }
        continue;
      }

      if (char === '\'' || char === '"') {
        quote = char;
        continue;
      }

      if (/\s/.test(char)) {
        if (current.length > 0) {
          tokens.push(current);
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (quote !== null) {
      throw new Error('ExecTool input command has mismatched quotes');
    }

    if (current.length > 0) {
      tokens.push(current);
    }

    return tokens;
  }

  private async spawnCommand(
    cmd: string,
    args: string[],
    timeoutMs: number
  ): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
    spawnError?: string;
  }> {
    let timedOut = false;
    let signal: NodeJS.Signals | null = null;

    const { child, getStdout, getStderr } = this.prepareCommandSpawn(cmd, args);
    const timer = this.startTimeoutTimer(child, timeoutMs, () => {
      timedOut = true;
    });

    try {
      const close = await this.waitForProcessClose(child, timer);
      signal = close.terminationSignal;
      const exitCode = close.code === null && timedOut ? 143 : close.code ?? 1;
      return {
        exitCode,
        stdout: getStdout(),
        stderr: getStderr(),
        signal,
        timedOut
      };
    } catch (error: unknown) {
      // A spawn failure (e.g. ENOENT for a missing binary) MUST become
      // evidence, never a thrown exception that crashes the agent (M3 §7).
      const message = error instanceof Error ? error.message : String(error);
      return {
        exitCode: 127,
        stdout: getStdout(),
        stderr: getStderr().length > 0 ? getStderr() : message,
        signal: null,
        timedOut,
        spawnError: message
      };
    }
  }

  private prepareCommandSpawn(
    cmd: string,
    args: string[]
  ): {
    child: ReturnType<typeof spawn>;
    getStdout: () => string;
    getStderr: () => string;
  } {
    let stdout = '';
    let stderr = '';
    const child = spawn(cmd, args, {
      cwd: this.workspace.resolveInside('.')
    });
    this.bindOutputBuffer(child, (chunk) => {
      stdout += String(chunk);
    }, (chunk) => {
      stderr += String(chunk);
    });

    return {
      child,
      getStdout: () => stdout,
      getStderr: () => stderr
    };
  }

  private startTimeoutTimer(child: ReturnType<typeof spawn>, timeoutMs: number, onTimeout: () => void): NodeJS.Timeout {
    return setTimeout(() => {
      onTimeout();
      child.kill('SIGTERM');
    }, timeoutMs);
  }

  private bindOutputBuffer(
    child: ReturnType<typeof spawn>,
    onStdout: (chunk: unknown) => void,
    onStderr: (chunk: unknown) => void
  ): void {
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', onStdout);
    child.stderr?.on('data', onStderr);
  }

  private waitForProcessClose(
    child: ReturnType<typeof spawn>,
    timer: NodeJS.Timeout
  ): Promise<{ code: number | null; terminationSignal: NodeJS.Signals | null }> {
    return new Promise((resolve, reject) => {
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', (closeCode, closeSignal) => {
        clearTimeout(timer);
        resolve({ code: closeCode, terminationSignal: closeSignal });
      });
    });
  }

  private async handleMkdirCommand(path: string, ctx: { acId: string; claimId: string }): Promise<Evidence> {
    const resolvedPath = this.workspace.resolveInside(path);
    await mkdir(resolvedPath, { recursive: true });

    return {
      claimId: ctx.claimId,
      acId: ctx.acId,
      evidenceType: 'file_exists',
      payload: {
        path: resolvedPath,
        exists: true
      },
      producedBy: 'tool'
    };
  }
}
