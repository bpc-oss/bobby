export type ModelRole = 'runner' | 'grader';

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface ModelCallOptions {
  json?: boolean;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

export interface ModelToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ModelResponse {
  content: string;
  toolCalls?: ModelToolCall[];
  raw?: unknown;
}

export interface ModelClient {
  complete(
    role: ModelRole,
    messages: ModelMessage[],
    opts?: ModelCallOptions
  ): Promise<ModelResponse>;
}
