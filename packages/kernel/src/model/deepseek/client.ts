import type { CapabilityReport } from './probe';
import type { ModelCallOptions, ModelClient, ModelMessage, ModelRole, ModelResponse } from '../model-client';
import type { HttpTransport } from './transport';
import type { ChatRequest, ChatResponse } from './transport';
import { buildProCacheMetadata } from './cache';

export interface DeepSeekModelClientDeps {
  apiKey: string;
  report: CapabilityReport;
  transport: HttpTransport;
}

export class DeepSeekModelClient implements ModelClient {
  constructor(private readonly deps: DeepSeekModelClientDeps) {}

  async complete(role: ModelRole, messages: ModelMessage[], opts?: ModelCallOptions): Promise<ModelResponse> {
    const roleModel = role === 'runner' ? this.deps.report.runnerModel : this.deps.report.graderModel;
    const model = opts?.model ?? roleModel;
    const reasoningEffort = this.deps.report.useReasoning
      ? role === 'grader'
        ? opts?.reasoningEffort ?? 'high'
        : opts?.reasoningEffort
      : undefined;
    const cacheMetadata = role === 'grader' && this.deps.report.useCaching
      ? buildProCacheMetadata(messages)
      : undefined;

    const req: ChatRequest = {
      model,
      messages,
      ...(reasoningEffort ? { reasoningEffort } : {}),
      ...(opts?.json === true && this.deps.report.useJsonMode ? { jsonMode: true } : {}),
      ...(cacheMetadata ? { cacheMetadata } : {})
    };

    const res = await this.deps.transport.chat(req);

    return this.toModelResponse(res);
  }

  private toModelResponse(res: ChatResponse): ModelResponse {
    return {
      content: res.content,
      raw: res
    };
  }
}
