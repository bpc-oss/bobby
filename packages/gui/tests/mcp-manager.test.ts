import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createMcpTransport, type McpTransportConfig } from '@bobby/kernel';
import { afterEach, expect, it } from 'vitest';
import { ensureDefaultMcpServers } from '../electron/mcp-manager';

const cleanup: string[] = [];

afterEach(() => {
  for (const path of cleanup.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

it('keeps the built-in filesystem MCP server inside the workspace root', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'bobby-mcp-user-data-'));
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-mcp-workspace-'));
  cleanup.push(userDataDir, workspaceRoot);

  const outsidePath = resolve(workspaceRoot, '..', `${basename(workspaceRoot)}-outside.txt`);
  cleanup.push(outsidePath);
  writeFileSync(join(workspaceRoot, 'inside.txt'), 'inside', 'utf8');
  writeFileSync(outsidePath, 'outside', 'utf8');

  const [server] = ensureDefaultMcpServers(userDataDir, workspaceRoot);
  if (!server || server.transport.kind !== 'stdio') {
    throw new Error('filesystem demo server was not created');
  }

  const transport = createMcpTransport({
    ...server.transport,
    cwd: workspaceRoot
  } satisfies McpTransportConfig);

  await expect(transport.call('read_file', { path: 'inside.txt' })).resolves.toMatchObject({
    stdout: 'inside',
    isError: false
  });
  await expect(transport.call('read_file', { path: `../${basename(outsidePath)}` })).resolves.toMatchObject({
    isError: true,
    stdout: expect.stringContaining('inside workspace')
  });
  await expect(transport.call('write_file', { path: `../${basename(outsidePath)}`, content: 'changed' })).resolves.toMatchObject({
    isError: true,
    stdout: expect.stringContaining('inside workspace')
  });

  expect(existsSync(outsidePath)).toBe(true);
  expect(readFileSync(outsidePath, 'utf8')).toBe('outside');
});
