import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadSubAgents, type SubAgentDescriptor } from '@bobby/kernel';
import type {
  SubAgentDispatchRecordDto,
  SubAgentRecordDto,
  SubAgentRemoveInput,
  SubAgentUpsertInput
} from '../src/ipc/contract';

const AGENTS_DIR = '.bobby/agents';
const DISPATCHES_FILE = '.bobby/subagent-dispatches.json';

function nowIso(): string {
  return new Date().toISOString();
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function formatArray(values: string[]): string {
  return `[${values.map((value) => quote(value)).join(', ')}]`;
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'agent';
}

function parseSource(markdown: string): { header: string; body: string } {
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

function parseArray(raw: string | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return [];
  }

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];

  return inner
    .split(',')
    .map((item) => item.trim())
    .map((item) => item.replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function resolveAgentsDir(workspaceRoot: string): string {
  return join(resolve(workspaceRoot), AGENTS_DIR);
}

function resolveWithinAgentsDir(workspaceRoot: string, targetPath: string): string {
  const root = resolveAgentsDir(workspaceRoot);
  const absolute = resolve(root, targetPath);
  const relativeToRoot = relative(root, absolute);
  if (relativeToRoot === '..' || relativeToRoot.startsWith(`..${sep}`) || isAbsolute(relativeToRoot)) {
    throw new Error('Subagent path must stay inside .bobby/agents');
  }

  return absolute;
}

export function resolveAgentPath(workspaceRoot: string, sourcePath?: string, name?: string): string {
  if (sourcePath) {
    return resolveWithinAgentsDir(workspaceRoot, sourcePath);
  }

  const fileName = `${slugify(name ?? 'agent')}.md`;
  return join(resolveAgentsDir(workspaceRoot), fileName);
}

function serializeAgent(agent: SubAgentUpsertInput): string {
  const fields = [
    '---',
    `name: ${quote(agent.name)}`,
    `description: ${quote(agent.description)}`,
    agent.model ? `model: ${quote(agent.model)}` : null,
    `tools: ${formatArray(agent.tools)}`,
    `triggers: ${formatArray(agent.triggers)}`,
    '---',
    agent.systemPrompt.trim(),
    ''
  ].filter((line): line is string => line !== null);

  return fields.join('\n');
}

function loadAgentFile(sourcePath: string): SubAgentRecordDto {
  const markdown = readFileSync(sourcePath, 'utf8');
  const split = parseSource(markdown);
  const fields = parseHeader(split.header);
  const body = split.body.trim();
  const descriptor: SubAgentDescriptor = {
    sourcePath,
    name: fields.name ? fields.name.replace(/^["']|["']$/g, '') : '',
    description: fields.description ? fields.description.replace(/^["']|["']$/g, '') : '',
    model: fields.model ? fields.model.replace(/^["']|["']$/g, '') : undefined,
    tools: parseArray(fields.tools),
    triggers: parseArray(fields.triggers),
    systemPrompt: body || '',
  };

  return {
    sourcePath: descriptor.sourcePath,
    name: descriptor.name,
    description: descriptor.description,
    model: descriptor.model,
    tools: descriptor.tools,
    triggers: descriptor.triggers,
    systemPrompt: descriptor.systemPrompt
  };
}

function loadDispatches(workspaceRoot: string): SubAgentDispatchRecordDto[] {
  const filePath = join(resolve(workspaceRoot), DISPATCHES_FILE);
  try {
    if (!existsSync(filePath)) {
      return [];
    }

    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => entry as SubAgentDispatchRecordDto)
      .filter((entry) =>
        typeof entry?.id === 'string' &&
        typeof entry.agentSourcePath === 'string' &&
        typeof entry.agentName === 'string' &&
        typeof entry.task === 'string'
      )
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  } catch {
    return [];
  }
}

function saveDispatches(workspaceRoot: string, records: SubAgentDispatchRecordDto[]): void {
  const filePath = join(resolve(workspaceRoot), DISPATCHES_FILE);
  ensureDir(dirname(filePath));
  writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
}

function updateDispatch(
  workspaceRoot: string,
  id: string,
  patch: Partial<SubAgentDispatchRecordDto>
): SubAgentDispatchRecordDto | null {
  const current = loadDispatches(workspaceRoot);
  const next = current.map((record) =>
    record.id === id ? { ...record, ...patch, updatedAt: nowIso() } : record
  );
  const found = next.find((record) => record.id === id) ?? null;
  if (!found) {
    return null;
  }

  saveDispatches(workspaceRoot, next);
  return found;
}

export function listSubAgents(workspaceRoot: string): SubAgentRecordDto[] {
  const result = loadSubAgents(workspaceRoot);
  return result.agents.map((agent) => ({
    sourcePath: agent.sourcePath,
    name: agent.name,
    description: agent.description,
    model: agent.model,
    tools: agent.tools,
    triggers: agent.triggers,
    systemPrompt: agent.systemPrompt
  }));
}

export function upsertSubAgent(workspaceRoot: string, input: SubAgentUpsertInput): SubAgentRecordDto {
  const sourcePath = resolveAgentPath(workspaceRoot, input.sourcePath, input.name);
  ensureDir(resolveAgentsDir(workspaceRoot));
  writeFileSync(sourcePath, serializeAgent(input), 'utf8');
  return loadAgentFile(sourcePath);
}

export function removeSubAgent(workspaceRoot: string, input: SubAgentRemoveInput): boolean {
  const sourcePath = resolveWithinAgentsDir(workspaceRoot, input.sourcePath);
  if (!existsSync(sourcePath)) {
    return false;
  }

  unlinkSync(sourcePath);
  return true;
}

export function listSubAgentDispatches(workspaceRoot: string): SubAgentDispatchRecordDto[] {
  return loadDispatches(workspaceRoot);
}

export function createSubAgentDispatchRecord(
  workspaceRoot: string,
  agent: SubAgentRecordDto,
  task: string
): SubAgentDispatchRecordDto {
  const record: SubAgentDispatchRecordDto = {
    id: randomUUID(),
    agentSourcePath: agent.sourcePath,
    agentName: agent.name,
    task,
    status: 'queued',
    mergeState: 'pending',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    worktreePath: null,
    proposalId: null,
    proposalPath: null,
    error: null
  };

  saveDispatches(workspaceRoot, [record, ...loadDispatches(workspaceRoot)]);
  return record;
}

export function updateSubAgentDispatchRecord(
  workspaceRoot: string,
  id: string,
  patch: Partial<SubAgentDispatchRecordDto>
): SubAgentDispatchRecordDto | null {
  return updateDispatch(workspaceRoot, id, patch);
}

export function markProposalApplied(workspaceRoot: string, proposalId: string): SubAgentDispatchRecordDto | null {
  const current = loadDispatches(workspaceRoot);
  const target = current.find((record) => record.proposalId === proposalId);
  if (!target) {
    return null;
  }

  return updateDispatch(workspaceRoot, target.id, {
    mergeState: 'applied',
    status: 'completed',
    error: null
  });
}
