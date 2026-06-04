export type ModelRole = 'runner' | 'grader';

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelResponse {
  content: string;
  raw?: unknown;
}

export interface ModelClient {
  complete(
    role: ModelRole,
    messages: ModelMessage[],
    opts?: {
      json?: boolean;
    }
  ): Promise<ModelResponse>;
}
