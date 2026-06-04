import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ExecTool } from '../src/hands/tools/exec';

const claimId = 'ac-claim-id';
const acId = 'ac-id';

it('executes a command and returns command_output evidence', async () => {
  const tool = new ExecTool(process.cwd());
  const result = await tool.run(
    {
      cmd: process.execPath,
      args: ['-e', 'process.stdout.write("hi");process.exit(0);']
    },
    {
      acId,
      claimId
    }
  );

  const evidence = result.evidence[0];
  expect(evidence).toMatchObject({
    claimId,
    acId,
    evidenceType: 'command_output',
    payload: {
      cmd: process.execPath,
      args: ['-e', 'process.stdout.write("hi");process.exit(0);'],
      exitCode: 0
    },
    producedBy: 'tool'
  });
  expect(evidence.payload.stdout).toContain('hi');
  expect(result.result).toMatchObject({ exitCode: 0 });
});

it('captures non-zero exit code', async () => {
  const tool = new ExecTool(process.cwd());
  const result = await tool.run(
    {
      cmd: process.execPath,
      args: ['-e', 'process.exit(7);']
    },
    {
      acId,
      claimId
    }
  );

  expect(result.evidence[0]?.payload).toMatchObject({
    exitCode: 7
  });
});

it('supports legacy command input by normalizing to cmd+args and returning command_output evidence', async () => {
  const tool = new ExecTool(process.cwd());
  const commandInput = 'node -e console.log(1)';

  const result = await tool.run(
    {
      command: commandInput
    },
    {
      acId,
      claimId
    }
  );

  const evidence = result.evidence[0];
  expect(evidence).toMatchObject({
    claimId,
    acId,
    evidenceType: 'command_output',
    payload: {
      cmd: 'node',
      args: ['-e', 'console.log(1)'],
      exitCode: 0
    },
    producedBy: 'tool'
  });
  expect(evidence.payload.stdout).toContain('1');
});

it('handles canonical mkdir -p command in workspace-safe mode without shell execution', async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-kernel-exec-canonical-mkdir-'));

  try {
    const tool = new ExecTool(workspaceRoot);
    const result = await tool.run(
      {
        cmd: 'mkdir',
        args: ['-p', 'demo']
      },
      {
        acId,
        claimId
      }
    );

    const evidence = result.evidence[0];
    expect(result.result).toMatchObject({ exitCode: 0 });
    expect(evidence).toMatchObject({
      claimId,
      acId,
      evidenceType: 'file_exists',
      payload: {
        path: join(workspaceRoot, 'demo'),
        exists: true
      },
      producedBy: 'tool'
    });
    expect(existsSync(join(workspaceRoot, 'demo'))).toBe(true);
  } finally {
    rmSync(workspaceRoot, { force: true, recursive: true });
  }
});

it('handles canonical mkdir command without -p in workspace-safe mode without shell execution', async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-kernel-exec-canonical-mkdir-simple-'));

  try {
    const tool = new ExecTool(workspaceRoot);
    const result = await tool.run(
      {
        cmd: 'mkdir',
        args: ['demo']
      },
      {
        acId,
        claimId
      }
    );

    const evidence = result.evidence[0];
    expect(result.result).toMatchObject({ exitCode: 0 });
    expect(evidence).toMatchObject({
      claimId,
      acId,
      evidenceType: 'file_exists',
      payload: {
        path: join(workspaceRoot, 'demo'),
        exists: true
      },
      producedBy: 'tool'
    });
    expect(existsSync(join(workspaceRoot, 'demo'))).toBe(true);
  } finally {
    rmSync(workspaceRoot, { force: true, recursive: true });
  }
});

it('handles legacy mkdir -p command in workspace-safe mode without shell execution', async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-kernel-exec-legacy-mkdir-'));

  try {
    const tool = new ExecTool(workspaceRoot);
    const result = await tool.run(
      {
        command: 'mkdir -p demo'
      },
      {
        acId,
        claimId
      }
    );

    const evidence = result.evidence[0];
    expect(result.result).toMatchObject({ exitCode: 0 });
    expect(evidence).toMatchObject({
      claimId,
      acId,
      evidenceType: 'file_exists',
      payload: {
        path: join(workspaceRoot, 'demo'),
        exists: true
      },
      producedBy: 'tool'
    });
    expect(existsSync(join(workspaceRoot, 'demo'))).toBe(true);
  } finally {
    rmSync(workspaceRoot, { force: true, recursive: true });
  }
});

it('rejects legacy mkdir command that escapes the workspace boundary', async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-kernel-exec-legacy-mkdir-outside-'));

  try {
    const tool = new ExecTool(workspaceRoot);
    await expect(
      tool.run(
        {
          command: 'mkdir -p ../outside'
        },
        {
          acId,
          claimId
        }
      )
    ).rejects.toThrow('Path outside workspace');
  } finally {
    rmSync(workspaceRoot, { force: true, recursive: true });
  }
});

it('rejects canonical mkdir command that escapes the workspace boundary', async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-kernel-exec-canonical-mkdir-outside-'));

  try {
    const tool = new ExecTool(workspaceRoot);
    await expect(
      tool.run(
        {
          cmd: 'mkdir',
          args: ['-p', '../outside']
        },
        {
          acId,
          claimId
        }
      )
    ).rejects.toThrow('Path outside workspace');
  } finally {
    rmSync(workspaceRoot, { force: true, recursive: true });
  }
});

it('rejects command alias with args present', async () => {
  const tool = new ExecTool(process.cwd());

  await expect(() =>
    tool.run(
      {
        command: 'node foo',
        args: ['bar']
      },
      {
        acId,
        claimId
      }
    )
  ).rejects.toThrow('ExecTool input command alias cannot include args');
});

it('terminates process on timeout and returns non-zero exit', async () => {
  const tool = new ExecTool(process.cwd());
  const result = await tool.run(
    {
      cmd: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 10000);'],
      timeoutMs: 200
    },
    {
      acId,
      claimId
    }
  );

  const payload = result.evidence[0]?.payload as {
    exitCode?: number;
    signal?: string | null;
    timedOut?: boolean;
  };

  expect(payload.exitCode).not.toBe(0);
  expect(payload.timedOut).toBe(true);
  expect(payload.signal).toBe('SIGTERM');
  expect(result.result).toMatchObject({ exitCode: expect.any(Number) });
});
