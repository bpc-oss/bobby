import { stdin as defaultStdin, stdout as defaultStdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import React from 'react';
import { render } from 'ink';
import type { KernelHost } from '@bobby/kernel';

import { App } from './ui/App';

type PromptInput = NodeJS.ReadStream;
type PromptOutput = NodeJS.WriteStream;

export type InteractiveDeps = {
  ask?: (prompt: string) => Promise<string | undefined>;
  close?: () => void;
  stdin?: PromptInput;
  stdout?: PromptOutput;
};

export type InteractiveIO = {
  log: (msg: string) => void;
};

export type InteractiveHandlers = {
  runTask: (task: string) => Promise<number>;
  createHost?: () => Promise<KernelHost>;
  printHelp: () => void;
  printStatus: () => void;
  probe: () => Promise<number>;
};

type Questioner = {
  ask: (prompt: string) => Promise<string | undefined>;
  close: () => void;
};

type InteractiveMode = 'line' | 'ink';

export function canStartInteractive(deps: InteractiveDeps = {}): boolean {
  if (deps.ask) {
    return true;
  }

  const input = deps.stdin ?? defaultStdin;
  const output = deps.stdout ?? defaultStdout;
  return input.isTTY === true && output.isTTY === true;
}

function createQuestioner(deps: InteractiveDeps): Questioner {
  if (deps.ask) {
    return {
      ask: deps.ask,
      close: deps.close ?? (() => undefined)
    };
  }

  const rl = createInterface({
    input: deps.stdin ?? defaultStdin,
    output: deps.stdout ?? defaultStdout
  });

  return {
    ask: async (prompt) => rl.question(prompt),
    close: () => rl.close()
  };
}

function isExitCommand(line: string): boolean {
  return ['/exit', '/quit', 'exit', 'quit'].includes(line.toLowerCase());
}

function isHelpCommand(line: string): boolean {
  return ['/help', 'help', '?'].includes(line.toLowerCase());
}

function shouldPrintStatus(line: string): boolean {
  return line === '/status';
}

function shouldRunProbe(line: string): boolean {
  return line === '/probe';
}

async function handleInteractiveLine(
  line: string,
  io: InteractiveIO,
  handlers: InteractiveHandlers,
  mode: InteractiveMode,
  host?: KernelHost
): Promise<boolean> {
  if (!line) {
    return true;
  }

  if (isExitCommand(line)) {
    io.log('bye');
    return false;
  }

  if (isHelpCommand(line)) {
    handlers.printHelp();
    return true;
  }

  if (shouldPrintStatus(line)) {
    handlers.printStatus();
    return true;
  }

  if (shouldRunProbe(line)) {
    const exitCode = await handlers.probe();
    if (exitCode !== 0) {
      io.log(`[interactive] probe exited ${exitCode}`);
    }
    return true;
  }

  if (mode === 'ink' && host) {
    await host.send({ type: 'startTask', input: line });
    return true;
  }

  const exitCode = await handlers.runTask(line);
  if (exitCode !== 0) {
    io.log(`[interactive] task exited ${exitCode}`);
  }
  return true;
}

async function runLineInteractive(
  io: InteractiveIO,
  handlers: InteractiveHandlers,
  deps: InteractiveDeps = {}
): Promise<void> {
  const questioner = createQuestioner(deps);

  io.log('Bobby interactive');
  io.log('Type a task, or /help for commands. Use /exit to quit.');

  try {
    while (true) {
      const answer = await questioner.ask('bobby> ');
      if (answer === undefined) {
        break;
      }

      const shouldContinue = await handleInteractiveLine(answer.trim(), io, handlers, 'line');
      if (!shouldContinue) {
        break;
      }
    }
  } finally {
    questioner.close();
  }
}

async function runInkInteractive(
  io: InteractiveIO,
  handlers: InteractiveHandlers
): Promise<void> {
  if (!handlers.createHost) {
    throw new Error('Interactive mode requires a host factory.');
  }

  const host = await handlers.createHost();

  const { unmount, waitUntilExit } = render(
    React.createElement(App, {
      host,
      onSubmit: async (command: string) => {
        try {
          const shouldContinue = await handleInteractiveLine(command, io, handlers, 'ink', host);
          if (!shouldContinue) {
            unmount();
          }
        } catch (error: unknown) {
          // Defense-in-depth: an unexpected error must never crash the TUI.
          io.log(error instanceof Error ? error.message : String(error));
        }
      },
      onGate: async (gateId, decision) => {
        await host.send({ type: 'approveGate', gateId, decision });
      },
      onAbort: async (taskId) => {
        await host.send({ type: 'abort', taskId });
      }
    })
  );

  io.log('Bobby interactive');
  io.log('Type a task, or /help for commands. Use /exit to quit.');
  await waitUntilExit();
}

export async function runInteractiveSession(
  io: InteractiveIO,
  handlers: InteractiveHandlers,
  deps: InteractiveDeps = {}
): Promise<void> {
  if (deps.ask || !canStartInteractive(deps)) {
    await runLineInteractive(io, handlers, deps);
    return;
  }

  await runInkInteractive(io, handlers);
}
