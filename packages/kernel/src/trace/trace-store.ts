import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { KernelEvent } from '@bobby/shared';

type TraceSummary = {
  taskId: string;
  events: number;
  status: 'done' | 'failed' | 'blocked' | 'running';
};

type PersistedTraceLine = {
  taskId: string;
  type: string;
  status?: TraceSummary['status'];
};

export type TraceStoreOptions = {
  workspaceRoot?: string;
  persistence?: boolean;
};

export class TraceStore {
  private readonly events = new Map<string, KernelEvent[]>();
  private readonly persistenceEnabled: boolean;
  private readonly tracesDir: string;

  constructor(options: TraceStoreOptions = {}) {
    const workspaceRoot = options.workspaceRoot ?? process.cwd();
    this.persistenceEnabled = options.persistence ?? false;
    this.tracesDir = join(workspaceRoot, '.bobby', 'traces');
  }

  append(taskId: string, event: KernelEvent): void {
    const current = this.events.get(taskId) ?? [];
    current.push(event);
    this.events.set(taskId, current);

    if (!this.persistenceEnabled) {
      return;
    }

    const filePath = join(this.tracesDir, `${taskId}.jsonl`);
    const serialized = this.serializeForPersistence(event);
    if (!serialized) {
      return;
    }

    try {
      mkdirSync(this.tracesDir, { recursive: true });
      appendFileSync(filePath, `${JSON.stringify(serialized)}\n`, 'utf8');
    } catch {
      // Persisting trace data is advisory. Any IO error is intentionally
      // non-fatal to keep the current process alive.
      return;
    }
  }

  get(taskId: string): readonly KernelEvent[] {
    return Object.freeze([...(this.events.get(taskId) ?? [])]);
  }

  getLatestSummary(): TraceSummary | null {
    if (!this.persistenceEnabled || !existsSync(this.tracesDir)) {
      return null;
    }

    const files = readdirSync(this.tracesDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map((entry) => join(this.tracesDir, entry.name));

    const fileStats = files
      .map((path) => {
        try {
          return {
            path,
            mtimeMs: statSync(path).mtimeMs
          };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { path: string; mtimeMs: number } => entry !== null)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    for (const entry of fileStats) {
      const summary = this.parseSummaryFromFile(entry.path);
      if (summary !== null) {
        return summary;
      }
    }

    return null;
  }

  private parseSummaryFromFile(path: string): TraceSummary | null {
    try {
      const content = readFileSync(path, 'utf8');
      let events = 0;
      let taskId: string | null = null;
      let status: TraceSummary['status'] = 'running';

      for (const raw of content.split(/\r?\n/)) {
        if (!raw.trim()) {
          continue;
        }

        const event = this.parsePersistedLine(raw);
        if (!event) {
          continue;
        }
        if (event.taskId === 'system') {
          continue;
        }

        events += 1;
        taskId = event.taskId;
        if (event.type === 'final_result' && event.status) {
          status = event.status;
        }
      }

      if (!taskId || events === 0) {
        return null;
      }

      return { taskId, events, status };
    } catch {
      return null;
    }
  }

  private parsePersistedLine(raw: string): PersistedTraceLine | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('taskId' in parsed) ||
      !('type' in parsed) ||
      typeof (parsed as { taskId: unknown }).taskId !== 'string' ||
      typeof (parsed as { type: unknown }).type !== 'string'
    ) {
      return null;
    }

    const line = parsed as PersistedTraceLine & { status?: unknown };
    if (
      line.status !== undefined &&
      line.status !== 'done' &&
      line.status !== 'failed' &&
      line.status !== 'blocked' &&
      line.status !== 'running'
    ) {
      return null;
    }

    return {
      taskId: line.taskId,
      type: line.type,
      status: line.status
    };
  }

  private serializeForPersistence(event: KernelEvent): PersistedTraceLine | null {
    if (event.taskId === 'system') {
      return null;
    }

    const base: PersistedTraceLine = { taskId: event.taskId, type: event.type };

    if (event.type === 'final_result') {
      return {
        ...base,
        status: event.status
      };
    }

    return base;
  }
}
