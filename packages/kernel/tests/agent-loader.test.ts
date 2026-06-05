import { describe, expect, it } from 'vitest';

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { loadSubAgents } from '../src/subagent/agent-loader';

function withAgentFile(repoRoot: string, name: string, markdown: string): void {
  const agentsDir = join(repoRoot, '.bobby', 'agents');
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, `${name}.md`), markdown, 'utf8');
}

function makeRepo(): string {
  return mkdtempSync(join(tmpdir(), 'bobby-agent-loader-'));
}

function withTempRepo<T>(callback: (repoRoot: string) => T): T {
  const repoRoot = makeRepo();
  try {
    return callback(repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

describe('agent-loader', () => {
  it('loads .bobby/agents/foo.md and parses frontmatter into structured agents', () => withTempRepo((repoRoot) => {
    withAgentFile(
      repoRoot,
      'foo',
      ['---', 'name: demo-agent', 'description: Tiny coding agent', 'model: deepseek-v4', 'tools: [read_file, write_file]', 'triggers:', '  - quickfix', 'systemPrompt: You are a focused helper', '---', 'fallback body prompt line'].join('\n')
    );
    const result = loadSubAgents(repoRoot);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]).toMatchObject({
      name: 'demo-agent',
      description: 'Tiny coding agent',
      model: 'deepseek-v4',
      tools: ['read_file', 'write_file'],
      triggers: ['quickfix'],
      systemPrompt: 'You are a focused helper'
    });
  }));

  it('reports diagnostics when name is missing', () => withTempRepo((repoRoot) => {
    withAgentFile(repoRoot, 'bad', ['---', 'description: Missing name', '---', 'system prompt from body'].join('\n'));
    const result = loadSubAgents(repoRoot);
    expect(result.agents).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.message).toContain('Missing required field "name"');
  }));

  it('uses markdown body as systemPrompt when frontmatter omits systemPrompt', () => withTempRepo((repoRoot) => {
    withAgentFile(
      repoRoot,
      'body',
      ['---', 'name: body-agent', 'description: uses body prompt', '---', 'This is fallback body prompt.'].join('\n')
    );
    const result = loadSubAgents(repoRoot);
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]!.systemPrompt).toBe('This is fallback body prompt.');
  }));
});
