import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createMcpTransport,
  mcpToolToBobbyTool,
  type McpTransportConfig,
  type McpToolOptions
} from '@bobby/kernel';
import type { ToolRegistry } from '@bobby/kernel';
import {
  McpServerRecordSchema,
  McpServerRemoveInputSchema,
  McpServerToggleInputSchema,
  McpServerUpsertInputSchema,
  type McpServerRecordDto,
  type McpServerRemoveInput,
  type McpServerToggleInput,
  type McpServerUpsertInput
} from '../src/ipc/contract';

const MCP_SERVERS_FILE = 'mcp-servers.json';

const DEMO_FILESYSTEM_SERVER_SOURCE = String.raw`import { createInterface } from 'node:readline';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const tools = [
  { name: 'read_file', description: 'Read a text file', permissionTier: 'L2' },
  { name: 'write_file', description: 'Write a text file', permissionTier: 'L1' },
  { name: 'list_directory', description: 'List directory entries', permissionTier: 'L0' },
  { name: 'stat_path', description: 'Inspect whether a path exists', permissionTier: 'L0' }
];

const send = (message) => {
  process.stdout.write(JSON.stringify(message) + '\\n');
};

const respond = (id, result) => {
  send({ jsonrpc: '2.0', id, result });
};

const respondError = (id, message) => {
  send({ jsonrpc: '2.0', id, error: { code: -32000, message } });
};

const readBody = (params) => (params && typeof params === 'object' ? params : {});

async function handleToolCall(name, params) {
  const input = readBody(params?.arguments);
  const cwd = process.cwd();

  if (name === 'read_file') {
    if (typeof input.path !== 'string') throw new Error('path is required');
    const path = resolve(cwd, input.path);
    const content = await readFile(path, 'utf8');
    return { stdout: content, isError: false, payload: { path, content } };
  }

  if (name === 'write_file') {
    if (typeof input.path !== 'string') throw new Error('path is required');
    const path = resolve(cwd, input.path);
    const content = String(input.content ?? '');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf8');
    return { stdout: 'wrote ' + path, isError: false, payload: { path, bytes: Buffer.byteLength(content, 'utf8'), content } };
  }

  if (name === 'list_directory') {
    const path = resolve(cwd, typeof input.path === 'string' ? input.path : '.');
    const entries = await readdir(path);
    return { stdout: JSON.stringify(entries), isError: false, payload: { path, entries } };
  }

  if (name === 'stat_path') {
    if (typeof input.path !== 'string') throw new Error('path is required');
    const path = resolve(cwd, input.path);
    try {
      const info = await stat(path);
      return { stdout: JSON.stringify({ exists: true, isDirectory: info.isDirectory() }), isError: false, payload: { path, exists: true, isDirectory: info.isDirectory() } };
    } catch {
      return { stdout: JSON.stringify({ exists: false }), isError: false, payload: { path, exists: false } };
    }
  }

  throw new Error('unknown tool: ' + name);
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', async (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    respondError(undefined, error instanceof Error ? error.message : String(error));
    return;
  }

  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    respondError(message?.id, 'invalid request');
    return;
  }

  try {
    if (message.method === 'initialize') {
      respond(message.id, {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'filesystem-demo', version: '1.0.0' },
        capabilities: { tools: {} }
      });
      return;
    }

    if (message.method === 'tools/list') {
      respond(message.id, {
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } }
        }))
      });
      return;
    }

    if (message.method === 'tools/call') {
      const result = await handleToolCall(message.params?.name, message.params);
      respond(message.id, result);
      return;
    }

    respondError(message.id, 'unknown method: ' + message.method);
  } catch (error) {
    respond(message.id, { stdout: error instanceof Error ? error.message : String(error), isError: true, payload: { error: error instanceof Error ? error.message : String(error) } });
  }
});
`;

export type McpHealth = 'unknown' | 'healthy' | 'error' | 'disabled';
type Tier = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

function userDataPath(baseDir: string, fileName: string): string {
  return join(baseDir, fileName);
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultTools(): Array<{ name: string; permissionTier: Tier; description: string; evidenceType?: 'command_output' | 'file_diff' | 'file_exists' }> {
  return [
    { name: 'read_file', permissionTier: 'L2', description: 'Read a text file from the workspace', evidenceType: 'command_output' },
    { name: 'write_file', permissionTier: 'L1', description: 'Write a text file inside the workspace', evidenceType: 'file_diff' },
    { name: 'list_directory', permissionTier: 'L0', description: 'List entries in a directory', evidenceType: 'command_output' },
    { name: 'stat_path', permissionTier: 'L0', description: 'Check whether a path exists', evidenceType: 'file_exists' }
  ];
}

function defaultServerTemplate(): McpServerUpsertInput {
  return {
    name: 'Filesystem Demo',
    enabled: true,
    transport: {
      kind: 'stdio',
      command: process.execPath,
      args: ['--input-type=module', '-e', DEMO_FILESYSTEM_SERVER_SOURCE],
      env: { ELECTRON_RUN_AS_NODE: '1' }
    },
    tools: defaultTools().map((tool) => ({
      name: tool.name,
      permissionTier: tool.permissionTier,
      description: tool.description,
      evidenceType: tool.evidenceType
    }))
  };
}

function ensureServersShape(raw: unknown[]): McpServerRecordDto[] {
  return raw
    .map((entry) => McpServerRecordSchema.safeParse(entry))
    .filter((result): result is { success: true; data: McpServerRecordDto } => result.success)
    .map((result) => result.data);
}

export function resolveMcpServersFile(userDataDir: string): string {
  return userDataPath(userDataDir, MCP_SERVERS_FILE);
}

export function loadMcpServers(userDataDir: string): McpServerRecordDto[] {
  const path = resolveMcpServersFile(userDataDir);
  try {
    if (!existsSync(path)) {
      return [];
    }

    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(parsed)) {
      return [];
    }

    return ensureServersShape(parsed);
  } catch {
    return [];
  }
}

export function saveMcpServers(userDataDir: string, servers: McpServerRecordDto[]): void {
  const path = resolveMcpServersFile(userDataDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(servers, null, 2), 'utf8');
}

export function ensureDefaultMcpServers(userDataDir: string, workspaceRoot: string): McpServerRecordDto[] {
  const existing = loadMcpServers(userDataDir);
  if (existing.length > 0) {
    return existing;
  }

  const createdAt = nowIso();
  const demo = defaultServerTemplate();
  const next: McpServerRecordDto[] = [
    {
      id: 'filesystem-demo',
      name: demo.name,
      enabled: demo.enabled ?? true,
      transport: demo.transport,
      tools: demo.tools,
      health: 'unknown',
      createdAt,
      updatedAt: createdAt,
      lastCheckedAt: null,
      lastError: null
    }
  ];
  saveMcpServers(userDataDir, next);
  return next;
}

export async function probeMcpServer(server: McpServerRecordDto, workspaceRoot: string): Promise<McpServerRecordDto> {
  if (!server.enabled) {
    return { ...server, health: 'disabled', lastCheckedAt: nowIso(), lastError: null };
  }

  const transportConfig: McpTransportConfig =
    server.transport.kind === 'stdio'
      ? { ...server.transport, cwd: server.transport.cwd ?? workspaceRoot }
      : server.transport;

  try {
    const transport = createMcpTransport(transportConfig);
    await transport.probe?.();
    return { ...server, health: 'healthy', lastCheckedAt: nowIso(), lastError: null };
  } catch (error) {
    return {
      ...server,
      health: 'error',
      lastCheckedAt: nowIso(),
      lastError: error instanceof Error ? error.message : String(error)
    };
  }
}

export function normalizeServerInput(input: McpServerUpsertInput): McpServerUpsertInput {
  const parsed = McpServerUpsertInputSchema.parse(input);
  return parsed;
}

export function upsertMcpServer(
  userDataDir: string,
  workspaceRoot: string,
  input: McpServerUpsertInput
): McpServerRecordDto {
  const parsed = normalizeServerInput(input);
  const existing = loadMcpServers(userDataDir);
  const now = nowIso();
  const current = parsed.id ? existing.find((item) => item.id === parsed.id) : null;
  const record: McpServerRecordDto = {
    id: current?.id ?? parsed.id ?? `mcp-${randomUUID().slice(0, 8)}`,
    name: parsed.name,
    enabled: parsed.enabled ?? current?.enabled ?? true,
    transport:
      parsed.transport.kind === 'stdio'
        ? { ...parsed.transport, cwd: parsed.transport.cwd ?? workspaceRoot }
        : parsed.transport,
    tools: parsed.tools,
    health: current?.health ?? 'unknown',
    lastCheckedAt: current?.lastCheckedAt ?? null,
    lastError: current?.lastError ?? null,
    createdAt: current?.createdAt ?? now,
    updatedAt: now
  };

  const next = current ? existing.map((item) => (item.id === record.id ? record : item)) : [...existing, record];
  saveMcpServers(userDataDir, next);
  return record;
}

export function toggleMcpServer(userDataDir: string, input: McpServerToggleInput): McpServerRecordDto {
  const parsed = McpServerToggleInputSchema.parse(input);
  const existing = loadMcpServers(userDataDir);
  const current = existing.find((item) => item.id === parsed.id);
  if (!current) {
    throw new Error('MCP server not found');
  }

  const next: McpServerRecordDto = {
    ...current,
    enabled: !current.enabled,
    updatedAt: nowIso(),
    health: current.enabled ? 'disabled' : 'unknown',
    lastError: current.enabled ? null : current.lastError
  };

  saveMcpServers(userDataDir, existing.map((item) => (item.id === next.id ? next : item)));
  return next;
}

export function removeMcpServer(userDataDir: string, input: McpServerRemoveInput): boolean {
  const parsed = McpServerRemoveInputSchema.parse(input);
  const existing = loadMcpServers(userDataDir);
  const next = existing.filter((item) => item.id !== parsed.id);
  if (next.length === existing.length) {
    return false;
  }
  saveMcpServers(userDataDir, next);
  return true;
}

export async function listMcpServers(userDataDir: string, workspaceRoot: string): Promise<McpServerRecordDto[]> {
  const next = await Promise.all(
    ensureDefaultMcpServers(userDataDir, workspaceRoot).map((server) => probeMcpServer(server, workspaceRoot))
  );
  saveMcpServers(userDataDir, next);
  return next;
}

export function registerMcpTools(
  registry: ToolRegistry,
  servers: McpServerRecordDto[],
  workspaceRoot: string
): void {
  for (const server of servers) {
    if (!server.enabled) {
      continue;
    }

    const transportConfig: McpTransportConfig =
      server.transport.kind === 'stdio'
        ? { ...server.transport, cwd: server.transport.cwd ?? workspaceRoot }
        : server.transport;

    const transport = createMcpTransport(transportConfig);
    for (const tool of server.tools) {
      const toolOptions: McpToolOptions = {
        serverId: server.id,
        permissionTier: tool.permissionTier,
        description: tool.description,
        evidenceType: tool.evidenceType
      };
      registry.register(mcpToolToBobbyTool(tool.name, transport, toolOptions));
    }
  }
}
