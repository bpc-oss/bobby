import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createMcpTransport, type McpTransportConfig } from '@bobby/kernel';
import { afterEach, expect, it } from 'vitest';
import { ensureDefaultMcpServers, probeMcpServer } from '../electron/mcp-manager';

const cleanup: string[] = [];

afterEach(() => {
  delete process.env.BOBBY_MCP_REQUEST_TIMEOUT_MS;
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

it('marks unresponsive MCP probes as errors instead of hanging', async () => {
  process.env.BOBBY_MCP_REQUEST_TIMEOUT_MS = '50';
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'bobby-mcp-timeout-workspace-'));
  cleanup.push(workspaceRoot);

  const result = await probeMcpServer({
    id: 'hung-server',
    name: 'Hung Server',
    enabled: true,
    transport: {
      kind: 'stdio',
      command: process.execPath,
      args: ['--input-type=module', '-e', 'setInterval(() => {}, 1000);'],
      env: { ELECTRON_RUN_AS_NODE: '1' }
    },
    tools: [],
    health: 'unknown',
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:00.000Z',
    lastCheckedAt: null,
    lastError: null
  }, workspaceRoot);

  expect(result.health).toBe('error');
  expect(result.lastError).toContain('timed out');
});
