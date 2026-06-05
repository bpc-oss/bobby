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
}

export interface ModelResponse {
  content: string;
  raw?: unknown;
}

export interface ModelClient {
  complete(
    role: ModelRole,
    messages: ModelMessage[],
    opts?: ModelCallOptions
  ): Promise<ModelResponse>;
}
