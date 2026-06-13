import type { ToolRegistry } from '../../hands/tool';

export interface OpenAiToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export function toToolSchemas(registry: ToolRegistry): OpenAiToolSchema[] {
  return registry.list().map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parametersSchema
    }
  }));
}
