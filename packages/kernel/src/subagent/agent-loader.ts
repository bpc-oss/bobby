import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

export interface SubAgentDescriptor {
  name: string;
  description: string;
  model?: string;
  tools: string[];
  triggers: string[];
  systemPrompt: string;
  sourcePath: string;
}

export interface SubAgentLoadDiagnostic {
  file: string;
  message: string;
}

export interface SubAgentLoadResult {
  agents: SubAgentDescriptor[];
  diagnostics: SubAgentLoadDiagnostic[];
}

const FRONTMATTER_OPEN = '---';

function splitFrontmatter(markdown: string): {
  frontmatter: string;
  body: string;
} {
  const lines = markdown.split(/\r?\n/);
  if (lines[0] !== FRONTMATTER_OPEN) {
    return { frontmatter: '', body: markdown };
  }

  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === FRONTMATTER_OPEN);
  if (closing === -1) {
    return { frontmatter: '', body: markdown };
  }

  return {
    frontmatter: lines.slice(1, closing).join('\n'),
    body: lines.slice(closing + 1).join('\n')
  };
}

function unquoteValue(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseArrayValue(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => unquoteValue(item))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => unquoteValue(String(entry)))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseFrontmatter(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!keyMatch) {
      continue;
    }

    const key = keyMatch[1];
    const rawValue = keyMatch[2].trim();

    if (!rawValue) {
      const values: string[] = [];

      while (index + 1 < lines.length && lines[index + 1].trim().startsWith('-')) {
        index += 1;
        const item = lines[index].replace(/^\s*-\s*/, '').trim();
        if (item.length > 0) {
          values.push(unquoteValue(item));
        }
      }

      result[key] = values;
      continue;
    }

    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      result[key] = parseArrayValue(rawValue.slice(1, -1));
      continue;
    }

    result[key] = unquoteValue(rawValue);
  }

  return result;
}

function parseAgentFile(sourcePath: string): { fields: Record<string, unknown>; body: string } {
  const markdown = readFileSync(sourcePath, 'utf8');
  const split = splitFrontmatter(markdown);
  return {
    fields: parseFrontmatter(split.frontmatter),
    body: split.body
  };
}

function buildAgentDescriptor(fields: Record<string, unknown>, body: string, sourcePath: string): SubAgentDescriptor {
  const name = unquoteValue(String(fields.name ?? '').trim());
  const description = unquoteValue(String(fields.description ?? '').trim());

  if (!name) {
    throw new Error(`Missing required field "name" in ${basename(sourcePath)}`);
  }

  if (!description) {
    throw new Error(`Missing required field "description" in ${basename(sourcePath)}`);
  }

  const model = fields.model ? unquoteValue(String(fields.model)) : undefined;
  const tools = normalizeArrayValue(fields.tools);
  const triggers = normalizeArrayValue(fields.triggers);
  const systemPrompt = fields.systemPrompt ? unquoteValue(String(fields.systemPrompt)) : body.trim();

  return {
    name,
    description,
    model,
    tools,
    triggers,
    systemPrompt,
    sourcePath
  };
}

export function loadSubAgents(repoRoot: string): SubAgentLoadResult {
  const root = resolve(repoRoot);
  const agentsDir = join(root, '.bobby', 'agents');
  const diagnostics: SubAgentLoadDiagnostic[] = [];
  const agents: SubAgentDescriptor[] = [];

  let entries: string[] = [];
  try {
    entries = readdirSync(agentsDir);
  } catch {
    return { agents, diagnostics };
  }

  for (const entry of entries.sort()) {
    if (!entry.endsWith('.md')) {
      continue;
    }

    const sourcePath = join(agentsDir, entry);
    const { fields, body } = parseAgentFile(sourcePath);

    try {
      agents.push(buildAgentDescriptor(fields, body, sourcePath));
    } catch (error) {
      diagnostics.push({
        file: sourcePath,
        message: error instanceof Error ? error.message : `Invalid agent descriptor in ${basename(sourcePath)}`
      });
    }
  }

  return { agents, diagnostics };
}
