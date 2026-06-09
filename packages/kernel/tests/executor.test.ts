import type { PlanStep } from '@bobby/shared';
import { describe, expect, it } from 'vitest';
import { executeStep } from '../src/brain/executor';
import { MockModelClient } from '../src/model/mock-model-client';

const step: PlanStep = {
  id: 'S1',
  desc: 'Scan directory',
  satisfiesAcIds: ['AC1'],
  dependsOn: []
};

const WINDOWS_PROMPT_EXPECTATIONS = [
  'Current platform: win32',
  'On Windows, avoid shell builtins: test, rm, cat, ls, touch.',
  'Prefer node/python for execution and use write_file/file_exists for file operations and assertions when possible.'
] as const;

const writeFileModel = (): MockModelClient => new MockModelClient({
  grader: [],
  runner: [
    JSON.stringify({
      calls: [{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }]
    })
  ]
});

const forbiddenCommandModel = (cmd: string): MockModelClient => new MockModelClient({
  grader: [],
  runner: [
    JSON.stringify({
      calls: [{ tool: 'exec', input: { cmd } }]
    })
  ]
});

const allowedWindowsModel = (): MockModelClient => new MockModelClient({
  grader: [],
  runner: [
    JSON.stringify({
      calls: [
        { tool: 'exec', input: { cmd: 'node', args: ['script.js'] } },
        { tool: 'exec', input: { cmd: 'python', args: ['-V'] } },
        { tool: 'write_file', input: { path: 'b.txt', content: 'ok' } },
        { tool: 'file_exists', input: { path: 'a.txt' } }
      ]
    })
  ]
});

describe('executeStep', () => {
  it('injects platform-specific runner prompt and Windows command restrictions', async () => {
    const model = writeFileModel();
    await executeStep(model, step, { platform: 'win32' });

    const systemPrompt = model.calls[0]?.messages[0]?.content ?? '';
    for (const phrase of WINDOWS_PROMPT_EXPECTATIONS) {
      expect(systemPrompt).toContain(phrase);
    }
  });

  it('parses strict JSON tool calls and returns them in claim', async () => {
    const model = writeFileModel();
    const claim = await executeStep(model, step);

    expect(claim.stepId).toBe('S1');
    expect(claim.acIds).toContain('AC1');
    expect(claim.calls).toEqual([{ tool: 'write_file', input: { path: 'a.txt', content: 'x' } }]);
  });
});

describe('executeStep (win32 validation)', () => {
  const forbiddenCommandInputModel = (input: Record<string, string>): MockModelClient => new MockModelClient({
    grader: [],
    runner: [
      JSON.stringify({
        calls: [{ tool: 'exec', input }]
      })
    ]
  });

  it.each(['test', 'rm', 'cat', 'ls', 'touch'])(
    'rejects forbidden win32 builtin %s in exec cmd',
    async (cmd) => {
      const model = forbiddenCommandModel(cmd);
      await expect(executeStep(model, step, { platform: 'win32' }))
        .rejects.toThrow(`is forbidden on win32`);
    }
  );

  it('rejects legacy exec command builtins on win32', async () => {
    const model = forbiddenCommandInputModel({ command: 'ls' });
    await expect(executeStep(model, step, { platform: 'win32' }))
      .rejects.toThrow('is forbidden on win32');
  });

  it('rejects case-insensitive exec builtin command on win32', async () => {
    const model = forbiddenCommandInputModel({ cmd: 'LS' });
    await expect(executeStep(model, step, { platform: 'win32' }))
      .rejects.toThrow('is forbidden on win32');
  });

  it('rejects non-JSON runner output', async () => {
    const model = new MockModelClient({ grader: [], runner: ['done'] });
    await expect(executeStep(model, step)).rejects.toThrow('executeStep: model response is not valid JSON');
  });

  it('allows allowed Windows commands and non-exec tools', async () => {
    const model = allowedWindowsModel();
    const claim = await executeStep(model, step, { platform: 'win32' });

    expect(claim.calls[0]?.tool).toBe('exec');
    expect(claim.calls[0]?.input.cmd).toBe('node');
    expect(claim.calls[2]?.tool).toBe('write_file');
    expect(claim.calls[3]?.tool).toBe('file_exists');
  });
});
