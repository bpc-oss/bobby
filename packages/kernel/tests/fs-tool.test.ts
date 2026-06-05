import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

import { expect, it } from 'vitest';

import { FileExistsTool, WriteFileTool } from '../src/hands/tools/fs';
import { Workspace } from '../src/hands/workspace';

const claimId = 'claim-file-id';
const acId = 'ac-file-id';

async function withWorkspace<T>(fn: (ws: Workspace) => Promise<T>): Promise<T> {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-kernel-fs-'));
  const ws = new Workspace(workspaceRoot);

  try {
    return await fn(ws);
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

it('writes a file and returns file_diff evidence, then file_exists returns true', async () => {
  await withWorkspace(async (ws) => {
    const writeTool = new WriteFileTool(ws);
    const existsTool = new FileExistsTool(ws);
    const content = 'hello world';
    const nestedPath = `nested${sep}a.txt`;

    const writeResult = await writeTool.run(
      {
        path: nestedPath,
        content
      },
      { acId, claimId }
    );

    const writeEvidence = writeResult.evidence[0];
    expect(writeEvidence).toMatchObject({
      claimId,
      acId,
      evidenceType: 'file_diff',
      producedBy: 'tool',
      payload: {
        path: expect.stringContaining(nestedPath),
        bytes: Buffer.byteLength(content),
        content
      }
    });

    const existsResult = await existsTool.run({ path: nestedPath }, { acId, claimId });
    expect(existsResult.result).toMatchObject({ exists: true });
    expect(existsResult.evidence[0]).toMatchObject({
      evidenceType: 'file_exists',
      producedBy: 'tool',
      payload: { path: expect.any(String), exists: true }
    });
  });
});

it('returns false when file does not exist', async () => {
  await withWorkspace(async (ws) => {
    const existsTool = new FileExistsTool(ws);
    const existsResult = await existsTool.run({ path: 'missing.txt' }, { acId, claimId });

    expect(existsResult).toMatchObject({
      result: { exists: false },
      evidence: [{ evidenceType: 'file_exists', payload: { path: expect.any(String), exists: false } }]
    });
  });
});

it('blocks write_file outside workspace', async () => {
  await withWorkspace(async (ws) => {
    const writeTool = new WriteFileTool(ws);
    await expect(writeTool.run({ path: '../escape.txt', content: 'should fail' }, { acId, claimId })).rejects.toThrow(
      /outside workspace/i
    );
  });
});

it('blocks file_exists outside workspace', async () => {
  await withWorkspace(async (ws) => {
    const existsTool = new FileExistsTool(ws);
    await expect(existsTool.run({ path: '../escape.txt' }, { acId, claimId })).rejects.toThrow(/outside workspace/i);
  });
});

it('writes nested path by creating parent directories', async () => {
  await withWorkspace(async (ws) => {
    const writeTool = new WriteFileTool(ws);
    const existsTool = new FileExistsTool(ws);

    await writeTool.run(
      {
        path: `nested${sep}path${sep}a.txt`,
        content: 'nested'
      },
      { acId, claimId }
    );

    const existsResult = await existsTool.run({ path: `nested${sep}path${sep}a.txt` }, { acId, claimId });
    expect(existsResult).toMatchObject({
      result: { exists: true },
      evidence: [{ evidenceType: 'file_exists', payload: { exists: true } }]
    });
  });
});
