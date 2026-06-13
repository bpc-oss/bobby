import { withRetry, type RetryOptions } from './retry';
import type { OpenAiToolSchema } from './tool-schema';

export interface ChatToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  tools?: OpenAiToolSchema[];
  jsonMode?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
  reasoning?: boolean;
  // Bobby-internal/cache hint for local observation only (not sent to API in this phase).
  cacheMetadata?: {
    prefix: string;
    prefixHash: string;
    sessionId: string;
    tools: readonly string[];
  };
}

export interface ChatResponse {
  content: string;
  model: string;
  toolCalls?: ChatToolCall[];
  usage?: { promptTokens: number; completionTokens: number; cachedTokens?: number };
}

export interface HttpTransport {
  chat(req: ChatRequest): Promise<ChatResponse>;
}

type FetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type FetchFn = (input: string, init?: RequestInit) => Promise<FetchResponse>;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export interface FetchTransportOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: FetchFn;
  retry?: false | {
    retries?: number;
    baseMs?: number;
    sleep?: (ms: number) => Promise<void>;
  };
}

export interface DeepSeekChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: unknown;
      tool_calls?: Array<{
        id?: unknown;
        function?: {
          name?: unknown;
          arguments?: unknown;
        };
      }>;
    };
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    cached_tokens?: unknown;
  };
}

function buildChatRequestBody(req: ChatRequest): string {
  const hasReasoningEffort = req.reasoningEffort !== undefined;
  return JSON.stringify({
    model: req.model,
    messages: req.messages,
    ...(req.tools ? { tools: req.tools } : {}),
    stream: false,
    ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    thinking: { type: hasReasoningEffort || req.reasoning ? 'enabled' : 'disabled' },
    ...(hasReasoningEffort
      ? { reasoning_effort: req.reasoningEffort }
      : req.reasoning
        ? { reasoning_effort: 'high' }
        : {})
  });
}

function makeHttpError(status: number): Error & { status: number } {
  const error = new Error(`DeepSeek request failed with status ${status}`) as Error & { status: number };
  error.status = status;
  return error;
}

function mapUsage(usage: DeepSeekChatResponse['usage']): ChatResponse['usage'] {
  if (
    usage &&
    typeof usage === 'object' &&
    usage.prompt_tokens !== undefined &&
    usage.completion_tokens !== undefined
  ) {
    return {
      promptTokens: Number(usage.prompt_tokens),
      completionTokens: Number(usage.completion_tokens),
      cachedTokens: usage.cached_tokens === undefined ? undefined : Number(usage.cached_tokens)
    };
  }

  return undefined;
}

function extractContent(raw: DeepSeekChatResponse): string {
  return typeof raw.choices?.[0]?.message?.content === 'string' ? raw.choices[0].message.content : '';
}

function extractToolCalls(raw: DeepSeekChatResponse): ChatToolCall[] | undefined {
  const toolCalls = raw.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return undefined;
  }

  return toolCalls
    .map((toolCall) => ({
      id: typeof toolCall.id === 'string' ? toolCall.id : '',
      name: typeof toolCall.function?.name === 'string' ? toolCall.function.name : '',
      arguments: typeof toolCall.function?.arguments === 'string' ? toolCall.function.arguments : ''
    }))
    .filter((toolCall) => toolCall.id !== '' && toolCall.name !== '');
}

function mapChatResponse(raw: DeepSeekChatResponse, requestModel: string): ChatResponse {
  return {
    content: extractContent(raw),
    model: typeof raw.model === 'string' ? raw.model : requestModel,
    toolCalls: extractToolCalls(raw),
    usage: mapUsage(raw.usage)
  };
}

export class FetchTransport implements HttpTransport {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchFn;
  private readonly retryConfig: false | RetryOptions;

  constructor(private readonly opts: FetchTransportOptions) {
    this.baseUrl = normalizeBaseUrl(opts.baseUrl ?? 'https://api.deepseek.com');
    this.fetchImpl = opts.fetch ?? (globalThis.fetch.bind(globalThis) as FetchFn);
    this.retryConfig = opts.retry === false ? false : { retries: 2, baseMs: 250, ...(opts.retry ?? {}) };
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const doRequest = async (): Promise<ChatResponse> => {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.opts.apiKey}`
        },
        body: buildChatRequestBody(req)
      });

      if (!response.ok) {
        throw makeHttpError(response.status);
      }

      return mapChatResponse((await response.json()) as DeepSeekChatResponse, req.model);
    };

    if (this.retryConfig === false) {
      return doRequest();
    }

    return withRetry(doRequest, {
      retries: this.retryConfig.retries,
      baseMs: this.retryConfig.baseMs,
      ...(this.retryConfig.sleep ? { sleep: this.retryConfig.sleep } : {})
    });
  }
}
