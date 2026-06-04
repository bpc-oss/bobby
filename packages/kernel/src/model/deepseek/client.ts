import type { CapabilityReport } from './probe';
import type { ModelClient, ModelMessage, ModelRole, ModelResponse } from '../model-client';
import type { HttpTransport } from './transport';
import type { ChatRequest, ChatResponse } from './transport';

export interface DeepSeekModelClientDeps {
  apiKey: string;
  report: CapabilityReport;
  transport: HttpTransport;
}

export class DeepSeekModelClient implements ModelClient {
  constructor(private readonly deps: DeepSeekModelClientDeps) {}

  async complete(role: ModelRole, messages: ModelMessage[], opts?: { json?: boolean }): Promise<ModelResponse> {
    const model = role === 'runner' ? this.deps.report.runnerModel : this.deps.report.graderModel;

    const req: ChatRequest = {
      model,
      messages,
      reasoning: role === 'grader' ? !!this.deps.report.useReasoning : false,
      ...(opts?.json === true && this.deps.report.useJsonMode ? { jsonMode: true } : {})
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
