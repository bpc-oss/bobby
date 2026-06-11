import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type {
  CommandRecordDto,
  CommandRemoveInput,
  CommandUpsertInput
} from '../src/ipc/contract';

const COMMANDS_DIR = '.bobby/commands';

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'command';
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function resolveCommandsDir(workspaceRoot: string): string {
  return join(resolve(workspaceRoot), COMMANDS_DIR);
}

function resolveWithinWorkspace(workspaceRoot: string, targetPath: string): string {
  const root = resolve(workspaceRoot);
  const absolute = resolve(root, targetPath);
  if (relative(root, absolute).startsWith('..')) {
    throw new Error('Command path must stay inside the workspace');
  }

  return absolute;
}

function splitSource(markdown: string): { header: string; body: string } {
  const lines = markdown.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { header: '', body: markdown.trim() };
  }

  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closing === -1) {
    return { header: '', body: markdown.trim() };
  }

  return {
    header: lines.slice(1, closing).join('\n'),
    body: lines.slice(closing + 1).join('\n').trim()
  };
}

function parseHeader(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    result[match[1]] = match[2].trim();
  }
  return result;
}

function resolveCommandPath(workspaceRoot: string, sourcePath?: string, name?: string): string {
  if (sourcePath) {
    return resolveWithinWorkspace(workspaceRoot, sourcePath);
  }

  return join(resolveCommandsDir(workspaceRoot), `${slugify(name ?? 'command')}.md`);
}

function loadCommandFile(sourcePath: string): CommandRecordDto {
  const markdown = readFileSync(sourcePath, 'utf8');
  const split = splitSource(markdown);
  const fields = parseHeader(split.header);
  const name = (fields.name ?? '').trim();
  const description = (fields.description ?? '').trim();
  const promptTemplate = (fields.prompt ?? split.body).trim();

  return {
    sourcePath,
    name,
    description,
    promptTemplate
  };
}

function serializeCommand(input: CommandUpsertInput): string {
  return [
    '---',
    `name: ${quote(input.name)}`,
    `description: ${quote(input.description)}`,
    '---',
    input.promptTemplate.trim(),
    ''
  ].join('\n');
}

export function listCommands(workspaceRoot: string): CommandRecordDto[] {
  const root = resolveCommandsDir(workspaceRoot);
  if (!existsSync(root)) {
    return [];
  }

  try {
    return readdirSync(root)
      .filter((entry) => entry.endsWith('.md'))
      .map((entry) => join(root, entry))
      .map((path) => loadCommandFile(path))
      .filter((record) => Boolean(record.name && record.description && record.promptTemplate))
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    return [];
  }
}

export function upsertCommand(workspaceRoot: string, input: CommandUpsertInput): CommandRecordDto {
  const sourcePath = resolveCommandPath(workspaceRoot, input.sourcePath, input.name);
  ensureDir(resolveCommandsDir(workspaceRoot));
  writeFileSync(sourcePath, serializeCommand(input), 'utf8');
  return loadCommandFile(sourcePath);
}

export function removeCommand(workspaceRoot: string, input: CommandRemoveInput): boolean {
  const sourcePath = resolveWithinWorkspace(workspaceRoot, input.sourcePath);
  if (!existsSync(sourcePath)) {
    return false;
  }

  unlinkSync(sourcePath);
  return true;
}
