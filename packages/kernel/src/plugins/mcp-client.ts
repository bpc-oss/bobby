import type { Evidence } from '@bobby/shared';
import type { Tool, ToolResult } from '../hands/tool';

export interface McpTransport {
  call(tool: string, args: unknown): Promise<{ stdout: string; isError: boolean }>;
}

export function mcpToolToBobbyTool(name: string, transport: McpTransport): Tool {
  return {
    name: `mcp:${name}`,
    permissionTier: 'L3',
    run: async (input, ctx): Promise<ToolResult> => {
      const result = await transport.call(name, input);

      const evidence: Evidence = {
        claimId: ctx.claimId,
        acId: ctx.acId,
        evidenceType: 'command_output',
        payload: {
          stdout: result.stdout,
          exitCode: result.isError ? 1 : 0
        },
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
