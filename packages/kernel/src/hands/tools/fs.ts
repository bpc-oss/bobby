import { mkdir, writeFile } from 'node:fs/promises';
import { stat } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { Evidence } from '@bobby/shared';
import type { Tool, ToolResult } from '../tool';
import { Workspace } from '../workspace';

export interface WriteInput {
  path: string;
  content?: unknown;
}

export interface ExistsInput {
  path: string;
}

export class WriteFileTool implements Tool {
  readonly name = 'write_file';
  readonly permissionTier = 'L1' as const;
  private static readonly maxEvidenceContentChars = 4096;

  constructor(private readonly ws: Workspace) {}

  async run(input: Record<string, unknown>, ctx: { acId: string; claimId: string }): Promise<ToolResult> {
    const { path, content } = this.parseInput(input);
    const resolvedPath = this.ws.resolveInside(path);
    const rawContent = String(content ?? '');

    await mkdir(dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, rawContent, 'utf8');

    const evidence: Evidence = {
      claimId: ctx.claimId,
      acId: ctx.acId,
      evidenceType: 'file_diff',
      payload: {
        path: resolvedPath,
        bytes: Buffer.byteLength(rawContent, 'utf8'),
        content: this.contentForEvidence(rawContent)
      },
      producedBy: 'tool'
    };

    return {
      evidence: [evidence],
      result: {
        path: resolvedPath
      }
    };
  }

  private parseInput(input: Record<string, unknown>): WriteInput {
    if (typeof input !== 'object' || input === null) {
      throw new Error('WriteFileTool input must be an object');
    }

    if (typeof input.path !== 'string') {
      throw new Error('WriteFileTool input path must be a string');
    }

    return {
      path: input.path,
      content: input.content
    };
  }

  private contentForEvidence(content: string): string | undefined {
    return content.length <= WriteFileTool.maxEvidenceContentChars ? content : undefined;
  }
}

export class FileExistsTool implements Tool {
  readonly name = 'file_exists';
  readonly permissionTier = 'L0' as const;

  constructor(private readonly ws: Workspace) {}

  async run(input: Record<string, unknown>, ctx: { acId: string; claimId: string }): Promise<ToolResult> {
    const { path } = this.parseInput(input);
    const resolvedPath = this.ws.resolveInside(path);
    const exists = await this.fileExists(resolvedPath);

    const evidence: Evidence = {
      claimId: ctx.claimId,
      acId: ctx.acId,
      evidenceType: 'file_exists',
      payload: {
        path: resolvedPath,
        exists
      },
      producedBy: 'tool'
    };

    return {
      evidence: [evidence],
      result: {
        exists
      }
    };
  }

  private parseInput(input: Record<string, unknown>): ExistsInput {
    if (typeof input !== 'object' || input === null) {
      throw new Error('FileExistsTool input must be an object');
    }

    if (typeof input.path !== 'string') {
      throw new Error('FileExistsTool input path must be a string');
    }

    return {
      path: input.path
    };
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }

      throw error;
    }
  }
}
