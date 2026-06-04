import { spawn } from 'node:child_process';

import type { Evidence } from '@bobby/shared';
import type { Tool, ToolResult } from '../tool';

export interface ExecInput {
  cmd: string;
  args?: string[];
  timeoutMs?: number;
}

export class ExecTool implements Tool {
  readonly name = 'exec';
  readonly permissionTier = 'L2' as const;

  constructor(private readonly cwd: string) {}

  async run(
    input: Record<string, unknown>,
    ctx: { acId: string; claimId: string }
  ): Promise<ToolResult> {
    const { cmd, args, timeoutMs } = this.parseInput(input);
    const outputs = await this.spawnCommand(cmd, args, timeoutMs);

    const evidence: Evidence = {
      claimId: ctx.claimId,
      acId: ctx.acId,
      evidenceType: 'command_output',
      payload: {
        cmd,
        args,
        exitCode: outputs.exitCode,
        stdout: outputs.stdout,
        stderr: outputs.stderr,
        signal: outputs.signal,
        timedOut: outputs.timedOut
      },
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
  } {
    if (typeof input !== 'object' || input === null) {
      throw new Error('ExecTool input must be an object');
    }

    if (typeof input?.cmd !== 'string') {
      throw new Error('ExecTool input cmd must be a string');
    }

    const args = input.args;
    if (args !== undefined && !Array.isArray(args)) {
      throw new Error('ExecTool input args must be an array of strings');
    }

    const sanitizedArgs = Array.isArray(args) ? args : [];
    if (!sanitizedArgs.every((arg) => typeof arg === 'string')) {
      throw new Error('ExecTool input args must be an array of strings');
    }

    const argsAsString = sanitizedArgs as string[];
    const timeoutMs = input.timeoutMs === undefined ? 60000 : input.timeoutMs;

    if (typeof timeoutMs !== 'number') {
      throw new Error('ExecTool input timeoutMs must be a number');
    }

    return {
      cmd: input.cmd,
      args: argsAsString,
      timeoutMs
    };
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
  }> {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let signal: NodeJS.Signals | null = null;

    const child = spawn(cmd, args, {
      cwd: this.cwd
    });

    this.bindOutputBuffer(child, (chunk) => {
      stdout += String(chunk);
    }, (chunk) => {
      stderr += String(chunk);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    const close = await this.waitForProcessClose(child, timer);

    signal = close.terminationSignal;

    const exitCode = close.code === null && timedOut ? 143 : close.code ?? 1;
    return {
      exitCode,
      stdout,
      stderr,
      signal,
      timedOut
    };
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
}
