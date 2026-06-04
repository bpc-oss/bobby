import { expect, it } from 'vitest';

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
