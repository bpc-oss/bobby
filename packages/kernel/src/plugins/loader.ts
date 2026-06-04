import type { ToolRegistry } from '../hands/tool';
import type { BobbyPlugin } from './plugin';

export function loadPlugin(registry: ToolRegistry, plugin: BobbyPlugin): void {
  for (const tool of plugin.tools) {
    registry.register(tool);
  }
}
