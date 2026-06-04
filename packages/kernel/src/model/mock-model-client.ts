import type {
  ModelClient,
  ModelMessage,
  ModelRole,
  ModelResponse
} from './model-client';

export class MockModelClient implements ModelClient {
  constructor(
    private readonly responses: Record<ModelRole, string[]>
  ) {}

  async complete(role: ModelRole, messages: ModelMessage[], opts?: { json?: boolean }): Promise<ModelResponse> {
    void messages;
    void opts;
    const queue = this.responses[role];

    if (!queue || queue.length === 0) {
      throw new Error(`MockModelClient: no queued response for role ${role}`);
    }

    return { content: queue.shift()! };
  }
}
