import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { type Evidence } from '@bobby/shared';
import type { Tier } from '../hands/permission';
import type { Tool, ToolResult } from '../hands/tool';

export interface McpResult {
  stdout: string;
  isError: boolean;
  payload?: Record<string, unknown>;
}

export interface McpTransport {
  probe?: () => Promise<void>;
  call(tool: string, args: unknown): Promise<McpResult>;
}

export interface StdioMcpTransportConfig {
  kind: 'stdio';
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface UrlMcpTransportConfig {
  kind: 'url';
  url: string;
  headers?: Record<string, string>;
}

export type McpTransportConfig = StdioMcpTransportConfig | UrlMcpTransportConfig;

export type McpEvidenceType = 'command_output' | 'file_diff' | 'file_exists';
const DEFAULT_MCP_REQUEST_TIMEOUT_MS = 5_000;

export interface McpToolOptions {
  toolName?: string;
  permissionTier?: Tier;
  description?: string;
  evidenceType?: McpEvidenceType;
  serverId?: string;
}

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: string;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc?: '2.0';
  id?: string;
  result?: unknown;
  error?: { code?: number; message?: string };
};

async function probeHttpTransport(url: string, headers: Record<string, string> = {}): Promise<void> {
  const controller = new AbortController();
  const timeoutMs = mcpRequestTimeoutMs();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: randomUUID(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: { name: 'bobby', version: '0.1.0' },
          capabilities: {}
        }
      })
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`MCP HTTP probe timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`MCP HTTP probe failed with ${response.status}`);
  }
}

async function callHttpTransport(
  url: string,
  tool: string,
  args: unknown,
  headers: Record<string, string> = {}
): Promise<McpResult> {
  const controller = new AbortController();
  const timeoutMs = mcpRequestTimeoutMs();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: randomUUID(),
        method: 'tools/call',
        params: { name: tool, arguments: args }
      })
    });
  } catch (error) {
    if (controller.signal.aborted) {
      return { stdout: `MCP HTTP request timed out after ${timeoutMs}ms`, isError: true };
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return { stdout: `HTTP ${response.status}`, isError: true, payload: { status: response.status } };
  }

  const body = (await response.json()) as JsonRpcResponse;
  const result = (body.result ?? {}) as Record<string, unknown>;
  return {
    stdout: typeof result.stdout === 'string' ? result.stdout : JSON.stringify(result),
    isError: Boolean(result.isError),
    payload: result.payload as Record<string, unknown> | undefined
  };
}

function parseJsonRpcLine(line: string): JsonRpcResponse | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as JsonRpcResponse;
  } catch {
    return null;
  }
}

function dispatchJsonRpcLine(
  line: string,
  pending: Map<string, { resolve: (response: JsonRpcResponse) => void; reject: (error: Error) => void }>,
  overflow: string[]
): void {
  const parsed = parseJsonRpcLine(line);
  if (parsed?.id && pending.has(parsed.id)) {
    pending.get(parsed.id)?.resolve(parsed);
    pending.delete(parsed.id);
  } else {
    overflow.push(line);
  }
}

function mcpRequestTimeoutMs(): number {
  const raw = Number.parseInt(process.env.BOBBY_MCP_REQUEST_TIMEOUT_MS ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MCP_REQUEST_TIMEOUT_MS;
}

function createJsonRpcSender(child: ChildProcessWithoutNullStreams): (method: string, params?: unknown) => Promise<JsonRpcResponse> {
  let buffer = '';
  let requestId = 0;
  const pending = new Map<string, { resolve: (response: JsonRpcResponse) => void; reject: (error: Error) => void }>();
  const responseQueue: string[] = [];

  const failPending = (error: Error): void => {
    for (const [id, entry] of pending) {
      entry.reject(error);
      pending.delete(id);
    }
  };

  const readNextLine = (): string | undefined => {
    const index = buffer.indexOf('\n');
    if (index === -1) {
      return undefined;
    }
    const line = buffer.slice(0, index);
    buffer = buffer.slice(index + 1);
    return line;
  };

  const flush = (): void => {
    for (let line = readNextLine(); line !== undefined; line = readNextLine()) {
      dispatchJsonRpcLine(line, pending, responseQueue);
    }
  };

  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    flush();
  });

  child.stderr.on('data', () => undefined);
  child.once('error', (error) => failPending(error));
  child.once('exit', (code, signal) => {
    failPending(new Error(`MCP stdio process exited before responding (code ${code ?? 'null'}, signal ${signal ?? 'null'})`));
  });

  return async (method: string, params?: unknown): Promise<JsonRpcResponse> => {
    const id = `${Date.now()}-${requestId += 1}`;
    const payload: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timeoutMs = mcpRequestTimeoutMs();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP stdio request "${method}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      pending.set(id, {
        resolve: (response) => {
          clearTimeout(timer);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      });
      child.stdin.write(`${JSON.stringify(payload)}\n`, 'utf8', (error) => {
        if (error) {
          pending.delete(id);
          clearTimeout(timer);
          reject(error);
        }
      });
    });
  };
}

async function waitForChildExit(child: ChildProcessWithoutNullStreams, timeoutMs = 1_000): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function runStdioSession<T>(
  config: StdioMcpTransportConfig,
  session: (process: ChildProcessWithoutNullStreams, send: (method: string, params?: unknown) => Promise<JsonRpcResponse>) => Promise<T>
): Promise<T> {
  const child = spawn(config.command, config.args ?? [], {
    cwd: config.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...config.env }
  });
  const send = createJsonRpcSender(child);

  try {
    return await session(child, send);
  } finally {
    child.kill();
    await waitForChildExit(child);
  }
}

async function probeStdioTransport(config: StdioMcpTransportConfig): Promise<void> {
  await runStdioSession(config, async (_process, send) => {
    const response = await send('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'bobby', version: '0.1.0' },
      capabilities: {}
    });
    if (response.error) {
      throw new Error(response.error.message ?? 'MCP initialize failed');
    }
    return undefined;
  });
}

async function callStdioTransport(
  config: StdioMcpTransportConfig,
  tool: string,
  args: unknown
): Promise<McpResult> {
  return await runStdioSession(config, async (_process, send) => {
    const initializeResponse = await send('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'bobby', version: '0.1.0' },
      capabilities: {}
    });
    if (initializeResponse.error) {
      return { stdout: initializeResponse.error.message ?? 'initialize failed', isError: true };
    }

    const response = await send('tools/call', { name: tool, arguments: args });
    const result = (response.result ?? {}) as Record<string, unknown>;
    return {
      stdout: typeof result.stdout === 'string' ? result.stdout : JSON.stringify(result),
      isError: Boolean(result.isError),
      payload: result.payload as Record<string, unknown> | undefined
    };
  });
}

export function createMcpTransport(config: McpTransportConfig): McpTransport {
  if (config.kind === 'url') {
    return {
      probe: async () => probeHttpTransport(config.url, config.headers),
      call: async (tool: string, args: unknown) => callHttpTransport(config.url, tool, args, config.headers)
    };
  }

  return {
    probe: async () => probeStdioTransport(config),
    call: async (tool: string, args: unknown) => callStdioTransport(config, tool, args)
  };
}

function mcpEvidencePayload(evidenceType: McpEvidenceType, result: McpResult): Record<string, unknown> {
  if (evidenceType === 'file_diff') {
    return {
      path: result.payload?.path ?? '',
      bytes: typeof result.payload?.bytes === 'number' ? result.payload.bytes : 0,
      content: typeof result.payload?.content === 'string' ? result.payload.content : undefined,
      patch:
        typeof result.payload?.patch === 'string'
          ? result.payload.patch
          : typeof result.payload?.diff === 'string'
            ? result.payload.diff
            : typeof result.payload?.content === 'string'
              ? result.payload.content
              : undefined,
      diff: typeof result.payload?.diff === 'string' ? result.payload.diff : undefined
    };
  }
  if (evidenceType === 'file_exists') {
    return {
      path: result.payload?.path ?? '',
      exists: Boolean(result.payload?.exists)
    };
  }
  return {
    stdout: result.stdout,
    exitCode: result.isError ? 1 : 0
  };
}

export function mcpToolToBobbyTool(name: string, transport: McpTransport, options: McpToolOptions = {}): Tool {
  const toolName = options.toolName ?? (options.serverId ? `mcp:${options.serverId}:${name}` : `mcp:${name}`);
  const evidenceType = options.evidenceType ?? 'command_output';

  return {
    name: toolName,
    permissionTier: options.permissionTier ?? 'L3',
    description: options.description,
    run: async (input, ctx): Promise<ToolResult> => {
      const result = await transport.call(name, input);

      const evidence: Evidence = {
        claimId: ctx.claimId,
        acId: ctx.acId,
        evidenceType,
        payload: mcpEvidencePayload(evidenceType, result),
        producedBy: 'tool'
      };

      return {
        evidence: [evidence],
        result: {
          ...result,
          exitCode: result.isError ? 1 : 0
        }
      };
    }
  };
}
