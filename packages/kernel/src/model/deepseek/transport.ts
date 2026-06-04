import { withRetry, type RetryOptions } from './retry';

export interface ChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  jsonMode?: boolean;
  reasoning?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
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
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    cached_tokens?: unknown;
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
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          stream: false,
          ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          thinking: { type: req.reasoning ? 'enabled' : 'disabled' },
          ...(req.reasoning ? { reasoning_effort: 'high' } : {})
        })
      });

      if (!response.ok) {
        const error = new Error(`DeepSeek request failed with status ${response.status}`) as Error & { status: number };
        error.status = response.status;
        throw error;
      }

      const raw = (await response.json()) as DeepSeekChatResponse;
      const content =
        typeof raw.choices?.[0]?.message?.content === 'string' ? raw.choices[0].message.content : '';
      const usage =
        raw.usage &&
        typeof raw.usage === 'object' &&
        raw.usage.prompt_tokens !== undefined &&
        raw.usage.completion_tokens !== undefined
          ? {
              promptTokens: Number(raw.usage.prompt_tokens),
              completionTokens: Number(raw.usage.completion_tokens),
              cachedTokens:
                raw.usage.cached_tokens === undefined ? undefined : Number(raw.usage.cached_tokens)
            }
          : undefined;

      return {
        content,
        model: typeof raw.model === 'string' ? raw.model : req.model,
        usage
      };
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
