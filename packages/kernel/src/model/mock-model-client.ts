import type {
  ModelClient,
  ModelMessage,
  ModelRole,
  ModelResponse,
  ModelCallOptions
} from './model-client';

export class MockModelClient implements ModelClient {
  public readonly calls: Array<{ role: ModelRole; messages: ModelMessage[]; opts?: ModelCallOptions }> = [];

  constructor(
    private readonly responses: Record<ModelRole, string[]>
  ) {}

  async complete(role: ModelRole, messages: ModelMessage[], opts?: ModelCallOptions): Promise<ModelResponse> {
    this.calls.push({ role, messages, opts });
    const queue = this.responses[role];

    if (!queue || queue.length === 0) {
      throw new Error(`MockModelClient: no queued response for role ${role}`);
    }

    return { content: queue.shift()! };
  }
}
