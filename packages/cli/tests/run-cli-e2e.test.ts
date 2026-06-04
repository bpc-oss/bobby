import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MockModelClient } from '@bobby/kernel';
import { runCli } from '../src/index';

const contractJson = JSON.stringify({
  goal: 'Create and run hello.py',
  acceptanceCriteria: [{ id: 'AC1', desc: 'The hello script runs', oracleHint: 'run' }],
  constraints: [],
  inputs: [],
  outOfScope: []
});

const stepsJson = JSON.stringify([
  { id: 'S1', desc: 'Create demo/hello.py and run it', satisfiesAcIds: ['AC1'], dependsOn: [] }
]);

const runnerJson = JSON.stringify({
  calls: [
    { tool: 'write_file', input: { path: 'demo/hello.py', content: 'console.log("hi")' } },
    { tool: 'exec', input: { cmd: 'node', args: ['demo/hello.py'] } }
  ]
});
const commandAliasRunnerJson = JSON.stringify({
  calls: [
    { tool: 'write_file', input: { path: 'demo/hello.py', content: 'console.log("hi")' } },
    { tool: 'exec', input: { command: 'node demo/hello.py' } }
  ]
});
const writeFileOnlyRunnerJson = JSON.stringify({
  calls: [{ tool: 'write_file', input: { path: 'demo/hello.py', content: 'console.log("hi")' } }]
});
const mkdirThenWriteThenRunRunnerJson = JSON.stringify({
  calls: [
    { tool: 'exec', input: { command: 'mkdir -p demo' } },
    { tool: 'write_file', input: { path: 'demo/hello.py', content: 'console.log("hi")' } },
    { tool: 'exec', input: { cmd: 'node', args: ['demo/hello.py'] } }
  ]
});

// eslint-disable-next-line max-lines-per-function
describe('CLI e2e (mock executor)', () => {
  it('prints real evidence and done for write_file + exec tool calls', async () => {
    const originalCwd = process.cwd();
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-cli-e2e-'));

    process.chdir(workspaceRoot);

    const logs: string[] = [];
    const exits: number[] = [];
    const io = {
      argv: ['run', 'create demo/hello.py and run it'],
      log: (msg: string) => {
        logs.push(msg);
      },
      exit: (code: number) => {
        exits.push(code);
      }
    };

    try {
      const model = new MockModelClient({
        grader: [contractJson, stepsJson],
        runner: [runnerJson]
      });

      await runCli(io, {
        makeModel: async () => model
      });

      const output = logs.join('\n');
      expect(exits).toEqual([0]);
      expect(existsSync(join(workspaceRoot, 'demo', 'hello.py'))).toBe(true);
      expect(output).toContain('[plan] goal:');
      expect(output).toContain('[plan] steps: S1');
      expect(output).toContain('[step] started S1');
      expect(output).toContain('[evidence] type=command_output');
      expect(output).not.toContain('deepseek-key');
      expect(output).toContain('[status] done');
    } finally {
      process.chdir(originalCwd);
      rmSync(workspaceRoot, { force: true, recursive: true });
    }
  });

  it('supports legacy exec command input and still finishes as done', async () => {
    const originalCwd = process.cwd();
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-cli-e2e-command-'));

    process.chdir(workspaceRoot);

    const logs: string[] = [];
    const exits: number[] = [];
    const io = {
      argv: ['run', 'create demo/hello.py and run it'],
      log: (msg: string) => {
        logs.push(msg);
      },
      exit: (code: number) => {
        exits.push(code);
      }
    };

    try {
      const model = new MockModelClient({
        grader: [contractJson, stepsJson],
        runner: [commandAliasRunnerJson]
      });

      await runCli(io, {
        makeModel: async () => model
      });

      const output = logs.join('\n');
      expect(exits).toEqual([0]);
      expect(existsSync(join(workspaceRoot, 'demo', 'hello.py'))).toBe(true);
      expect(output).toContain('[evidence] type=command_output');
      expect(output).toContain('[status] done');
      expect(output).not.toContain('[error]');
    } finally {
      process.chdir(originalCwd);
      rmSync(workspaceRoot, { force: true, recursive: true });
    }
  });

  it('finishes as done when only write_file evidence is produced', async () => {
    const originalCwd = process.cwd();
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-cli-e2e-file-diff-'));

    process.chdir(workspaceRoot);

    const logs: string[] = [];
    const exits: number[] = [];
    const io = {
      argv: ['run', 'create demo/hello.py and run it'],
      log: (msg: string) => {
        logs.push(msg);
      },
      exit: (code: number) => {
        exits.push(code);
      }
    };

    try {
      const model = new MockModelClient({
        grader: [contractJson, stepsJson],
        runner: [writeFileOnlyRunnerJson]
      });

      await runCli(io, {
        makeModel: async () => model
      });

      const output = logs.join('\n');
      expect(exits).toEqual([0]);
      expect(existsSync(join(workspaceRoot, 'demo', 'hello.py'))).toBe(true);
      expect(output).toContain('[evidence] type=file_diff');
      expect(output).toContain('[status] done');
      expect(output).not.toContain('[error]');
    } finally {
      process.chdir(originalCwd);
      rmSync(workspaceRoot, { force: true, recursive: true });
    }
  });

  it('maps plain-text runner output to failed exit', async () => {
    const originalCwd = process.cwd();
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-cli-e2e-fail-'));

    process.chdir(workspaceRoot);

    const logs: string[] = [];
    const exits: number[] = [];
    const io = {
      argv: ['run', 'create demo/hello.py and run it'],
      log: (msg: string) => {
        logs.push(msg);
      },
      exit: (code: number) => {
        exits.push(code);
      }
    };

    try {
      const model = new MockModelClient({
        grader: [contractJson, stepsJson],
        runner: ['done']
      });

      await runCli(io, {
        makeModel: async () => model
      });

      const output = logs.join('\n');
      expect(exits).toEqual([1]);
      expect(output).toContain('[status] failed');
      expect(output).toContain('model response is not valid JSON');
      expect(existsSync(join(workspaceRoot, 'demo', 'hello.py'))).toBe(false);
    } finally {
      process.chdir(originalCwd);
      rmSync(workspaceRoot, { force: true, recursive: true });
    }
  });

  it('handles real legacy mkdir command before write_file and still finishes with command_output', async () => {
    const originalCwd = process.cwd();
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-cli-e2e-mkdir-'));

    process.chdir(workspaceRoot);

    const logs: string[] = [];
    const exits: number[] = [];
    const io = {
      argv: ['run', 'create demo/hello.py and run it'],
      log: (msg: string) => {
        logs.push(msg);
      },
      exit: (code: number) => {
        exits.push(code);
      }
    };

    try {
      const model = new MockModelClient({
        grader: [contractJson, stepsJson],
        runner: [mkdirThenWriteThenRunRunnerJson]
      });

      await runCli(io, {
        makeModel: async () => model
      });

      const output = logs.join('\n');
      expect(exits).toEqual([0]);
      expect(existsSync(join(workspaceRoot, 'demo', 'hello.py'))).toBe(true);
      expect(output).toContain('[evidence] type=command_output');
      expect(output).toContain('[status] done');
      expect(output).toContain('[evidence] type=file_exists');
      expect(output).not.toContain('[error]');
    } finally {
      process.chdir(originalCwd);
      rmSync(workspaceRoot, { force: true, recursive: true });
    }
  });
});
