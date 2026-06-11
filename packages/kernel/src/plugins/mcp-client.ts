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
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
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
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'tools/call',
      params: { name: tool, arguments: args }
    })
  });

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

async function runStdioSession<T>(
  config: StdioMcpTransportConfig,
  session: (process: ChildProcessWithoutNullStreams, send: (method: string, params?: unknown) => Promise<JsonRpcResponse>) => Promise<T>
): Promise<T> {
  const child = spawn(config.command, config.args ?? [], {
    cwd: config.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...config.env }
  });

  let buffer = '';
  let requestId = 0;
  const pending = new Map<string, (response: JsonRpcResponse) => void>();
  const responseQueue: string[] = [];

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
    let line = readNextLine();
    while (line !== undefined) {
      const parsed = parseJsonRpcLine(line);
      if (parsed?.id && pending.has(parsed.id)) {
        pending.get(parsed.id)?.(parsed);
        pending.delete(parsed.id);
      } else {
        responseQueue.push(line);
      }
      line = readNextLine();
    }
  };

  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    flush();
  });

  child.stderr.on('data', () => undefined);

  const send = async (method: string, params?: unknown): Promise<JsonRpcResponse> => {
    const id = `${Date.now()}-${requestId += 1}`;
    const payload: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    const response = await new Promise<JsonRpcResponse>((resolve, reject) => {
      pending.set(id, resolve);
      child.stdin.write(`${JSON.stringify(payload)}\n`, 'utf8', (error) => {
        if (error) {
          pending.delete(id);
          reject(error);
        }
      });
      child.once('error', reject);
    });
    return response;
  };

  try {
    const result = await session(child, send);
    return result;
  } finally {
    child.kill();
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

export function mcpToolToBobbyTool(name: string, transport: McpTransport, options: McpToolOptions = {}): Tool {
  const toolName = options.toolName ?? (options.serverId ? `mcp:${options.serverId}:${name}` : `mcp:${name}`);
  const evidenceType = options.evidenceType ?? 'command_output';

  return {
    name: toolName,
    permissionTier: options.permissionTier ?? 'L3',
    description: options.description,
    run: async (input, ctx): Promise<ToolResult> => {
      const result = await transport.call(name, input);

      const payload =
        evidenceType === 'file_diff'
          ? {
              path: result.payload?.path ?? '',
              bytes: typeof result.payload?.bytes === 'number' ? result.payload.bytes : 0,
              content: result.payload?.content
            }
          : evidenceType === 'file_exists'
            ? {
                path: result.payload?.path ?? '',
                exists: Boolean(result.payload?.exists)
              }
            : {
                stdout: result.stdout,
                exitCode: result.isError ? 1 : 0
              };

      const evidence: Evidence = {
        claimId: ctx.claimId,
        acId: ctx.acId,
        evidenceType,
        payload,
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
