import { expect, it } from 'vitest';

import { type Tool, ToolRegistry } from '../src/hands/tool';
import type { Tier } from '../src/hands/permission';

const createTool = (name: string): Tool => ({
  name,
  permissionTier: 'L0' as Tier,
  run: async () => ({
    evidence: [],
    result: { name },
  }),
});

it('register and get by name', () => {
  const registry = new ToolRegistry();
  const tool = createTool('noop');

  registry.register(tool);

  expect(registry.get('noop').name).toBe('noop');
});

it('throws for unknown tool', () => {
  const registry = new ToolRegistry();

  expect(() => registry.get('missing')).toThrow(/unknown tool/i);
});

it('lists tools in registration order', () => {
  const registry = new ToolRegistry();
  const first = createTool('first');
  const second = createTool('second');

  registry.register(first);
  registry.register(second);

  expect(registry.list()).toEqual([first, second]);
});

it('overwrites existing tool with same name', () => {
  const registry = new ToolRegistry();
  const oldTool = createTool('noop');
  const newTool = createTool('noop');

  registry.register(oldTool);
  registry.register(newTool);

  expect(registry.get('noop')).toBe(newTool);
  expect(registry.list()).toHaveLength(1);
  expect(registry.list()[0]).toBe(newTool);
});
