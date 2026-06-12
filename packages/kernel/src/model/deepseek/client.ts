import { readFile as defaultReadFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CapabilityReport } from './probe';
import type { ModelCallOptions, ModelClient, ModelMessage, ModelRole, ModelResponse } from '../model-client';
import type { HttpTransport } from './transport';
import type { ChatContentPart, ChatMessage, ChatRequest, ChatResponse } from './transport';
import { buildProCacheMetadata } from './cache';

export interface DeepSeekModelClientDeps {
  apiKey: string;
  report: CapabilityReport;
  transport: HttpTransport;
  workspaceRoot?: string;
  readFile?: (path: string) => Promise<Uint8Array | Buffer>;
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
      messages: await this.prepareMessages(messages),
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

  private async prepareMessages(messages: ModelMessage[]): Promise<ChatRequest['messages']> {
    if (!this.deps.report.useVision) {
      return messages;
    }

    const prepared = await Promise.all(messages.map((message) => this.prepareVisionMessage(message)));
    return prepared.every((message, index) => message === messages[index]) ? messages : prepared;
  }

  private async prepareVisionMessage(message: ModelMessage): Promise<ChatMessage> {
    if (message.role !== 'user' || !message.content.includes('![')) {
      return message;
    }

    const parts: ChatContentPart[] = [];
    const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let cursor = 0;
    let converted = false;

    for (const match of message.content.matchAll(imagePattern)) {
      const start = match.index ?? 0;
      const rawUrl = match[2]?.trim() ?? '';
      const before = message.content.slice(cursor, start);
      if (before) {
        parts.push({ type: 'text', text: before });
      }

      const imageUrl = await this.resolveImageUrl(rawUrl);
      if (imageUrl) {
        const alt = match[1]?.trim();
        if (alt) {
          parts.push({ type: 'text', text: `[Image: ${alt}]` });
        }
        parts.push({ type: 'image_url', image_url: { url: imageUrl } });
        converted = true;
      } else {
        parts.push({ type: 'text', text: match[0] ?? '' });
      }

      cursor = start + (match[0]?.length ?? 0);
    }

    const after = message.content.slice(cursor);
    if (after) {
      parts.push({ type: 'text', text: after });
    }

    return converted ? { ...message, content: parts } : message;
  }

  private async resolveImageUrl(rawUrl: string): Promise<string | null> {
    if (/^data:image\//i.test(rawUrl) || /^https?:\/\//i.test(rawUrl)) {
      return rawUrl;
    }

    const workspaceRoot = this.deps.workspaceRoot;
    if (!workspaceRoot) {
      return null;
    }

    let candidate = rawUrl.replace(/^['"]|['"]$/g, '');
    try {
      if (candidate.startsWith('file://')) {
        candidate = fileURLToPath(candidate);
      }
    } catch {
      return null;
    }

    const absolute = resolve(isAbsolute(candidate) ? candidate : resolve(workspaceRoot, candidate));
    const root = resolve(workspaceRoot);
    const rel = relative(root, absolute);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return null;
    }

    const mime = imageMimeForPath(absolute);
    if (!mime) {
      return null;
    }

    try {
      const readFile = this.deps.readFile ?? defaultReadFile;
      const data = await readFile(absolute);
      return `data:${mime};base64,${Buffer.from(data).toString('base64')}`;
    } catch {
      return null;
    }
  }
}

function imageMimeForPath(path: string): string | null {
  switch (extname(path).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.bmp':
      return 'image/bmp';
    default:
      return null;
  }
}
