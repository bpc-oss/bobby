import { expect, it } from 'vitest';

import { type Tool, ToolRegistry } from '../src/hands/tool';
import type { BobbyPlugin } from '../src/plugins/plugin';
import { loadPlugin } from '../src/plugins/loader';
import { mcpToolToBobbyTool } from '../src/plugins/mcp-client';
import type { McpTransport } from '../src/plugins/mcp-client';

const createPluginTool = (name: string): Tool => ({
  name,
  description: `${name} plugin tool`,
  parametersSchema: {
    type: 'object',
    properties: {
      greeting: {
        type: 'string'
      }
    },
    additionalProperties: true
  },
  permissionTier: 'L1',
  run: async (input: Record<string, unknown>, ctx) => {
    if (input && typeof input.greeting !== 'string') {
      throw new Error('invalid input');
    }

    return {
      evidence: [
        {
          claimId: ctx.claimId,
          acId: ctx.acId,
          evidenceType: 'command_output',
          payload: {
            stdout: 'hi'
          },
          producedBy: 'tool'
        }
      ],
      result: {
        ok: true
      }
    };
  }
});

it('registers plugin tools into registry and can execute them', async () => {
  const registry = new ToolRegistry();
  const plugin: BobbyPlugin = {
    name: 'hello-plugin',
    tools: [createPluginTool('hello')]
  };

  loadPlugin(registry, plugin);
  const tool = registry.get('hello');
  const result = await tool.run({ greeting: 'world' }, { acId: 'ac-1', claimId: 'claim-1' });

  expect(result.result).toEqual({ ok: true });
  expect(result.evidence).toHaveLength(1);
  const evidence = result.evidence[0];
  expect(evidence.claimId).toBe('claim-1');
  expect(evidence.acId).toBe('ac-1');
  expect(evidence.evidenceType).toBe('command_output');
  expect(evidence.producedBy).toBe('tool');
  expect(evidence.payload.stdout).toBe('hi');
});

it('registers all tools when loading plugin', () => {
  const registry = new ToolRegistry();
  const plugin: BobbyPlugin = {
    name: 'multi-plugin',
    tools: [createPluginTool('a'), createPluginTool('b')]
  };

  loadPlugin(registry, plugin);

  expect(registry.list().map((tool) => tool.name)).toEqual(['a', 'b']);
  expect(registry.get('a').name).toBe('a');
  expect(registry.get('b').name).toBe('b');
});

it('adapts MCP tools with L3 tier and command output evidence', async () => {
  let capturedTool = '';
  let capturedArgs: unknown = undefined;
  const transport: McpTransport = {
    call: async (tool: string, args: unknown) => {
      capturedTool = tool;
      capturedArgs = args;
      return { stdout: 'ok', isError: false };
    }
  };

  const tool = mcpToolToBobbyTool('status', transport);

  expect(tool.name).toBe('mcp:status');
  expect(tool.permissionTier).toBe('L3');

  const result = await tool.run({ sample: 1 }, { acId: 'ac-2', claimId: 'claim-2' });

  expect(capturedTool).toBe('status');
  expect(capturedArgs).toEqual({ sample: 1 });

  const commandResult = result.result as {
    stdout: string;
    isError: boolean;
    exitCode: number;
  };
  expect(commandResult.exitCode).toBe(0);
  expect(result.evidence).toHaveLength(1);
  const evidence = result.evidence[0];
  expect(evidence.claimId).toBe('claim-2');
  expect(evidence.acId).toBe('ac-2');
  expect(evidence.evidenceType).toBe('command_output');
  expect(evidence.producedBy).toBe('tool');
  expect(evidence.payload).toEqual({
    stdout: 'ok',
    exitCode: 0
  });
});

it('maps MCP error transport results to exitCode 1', async () => {
  const transport: McpTransport = {
    call: async () => ({ stdout: 'fail', isError: true })
  };
  const tool = mcpToolToBobbyTool('fail', transport);

  const result = await tool.run({}, { acId: 'ac-3', claimId: 'claim-3' });

  const commandResult = result.result as {
    stdout: string;
    isError: boolean;
    exitCode: number;
  };
  expect(commandResult.exitCode).toBe(1);
  expect(result.evidence).toHaveLength(1);
  expect(result.evidence[0].payload.exitCode).toBe(1);
});
