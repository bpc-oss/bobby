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
