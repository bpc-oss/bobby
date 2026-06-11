import type { Evidence } from '@bobby/shared';
import type { Tier } from './permission';

export interface ToolResult {
  evidence: Evidence[];
  result: unknown;
}

export interface Tool {
  name: string;
  permissionTier: Tier;
  description?: string;
  run(input: Record<string, unknown>, ctx: { acId: string; claimId: string }): Promise<ToolResult>;
}

export class ToolRegistry {
  private map = new Map<string, Tool>();

  register(t: Tool): void {
    this.map.set(t.name, t);
  }

  get(name: string): Tool {
    const t = this.map.get(name);
    if (!t) {
      throw new Error(`unknown tool: ${name}`);
    }
    return t;
  }

  unregister(name: string): boolean {
    return this.map.delete(name);
  }

  clear(): void {
    this.map.clear();
  }

  list(): Tool[] {
    return [...this.map.values()];
  }
}
