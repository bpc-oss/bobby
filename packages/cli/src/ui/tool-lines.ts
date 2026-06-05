import type { Evidence } from '@bobby/shared';

const MAX_OUTPUT_PREVIEW = 120;

type Severity = 'pass' | 'fail' | 'neutral';

export type EvidenceDisplay = {
  text: string;
  severity: Severity;
};

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}

function truncateOutput(text: string): string {
  const flattened = text.replace(/\n+/g, ' ');
  return flattened.length <= MAX_OUTPUT_PREVIEW ? flattened : `${flattened.slice(0, MAX_OUTPUT_PREVIEW)}...`;
}

export function formatToolCalledLine(tool: string): string {
  const trimmed = tool.trim();
  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace < 0) {
    return `* ${trimmed}()`;
  }

  const toolName = trimmed.slice(0, firstSpace);
  const args = trimmed.slice(firstSpace + 1).trim();

  return `* ${toolName}(${args})`;
}

function summarizeCommandOutput(evidence: Evidence): EvidenceDisplay {
  const payload = evidence.payload as Record<string, unknown>;
  const exitCode = asNumber(payload.exitCode);
  const passed = exitCode === 0;

  const preferredPayload =
    !passed && asString(payload.stderr)
      ? `stderr: ${truncateOutput(payload.stderr as string)}`
      : asString(payload.stdout)
        ? `stdout: ${truncateOutput(payload.stdout as string)}`
        : asString(payload.output)
          ? `output: ${truncateOutput(payload.output as string)}`
          : asString(payload.stderr)
            ? `stderr: ${truncateOutput(payload.stderr as string)}`
            : undefined;

  const parts = [`${evidence.evidenceType}(exitCode=${exitCode ?? 'missing'}`];

  if (preferredPayload !== undefined) {
    parts.push(preferredPayload);
  }

  return {
    severity: passed ? 'pass' : 'fail',
    text: `* ${parts.join(', ')})`
  };
}

function summarizeFileDiff(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  const path = asString(payload.path);
  const bytes = asNumber(payload.bytes);

  if (path !== undefined) {
    parts.push(`path=${path}`);
  }

  if (bytes !== undefined) {
    parts.push(`bytes=${bytes}`);
  }

  const details = parts.length > 0 ? parts.join(', ') : 'details unavailable';
  return `file_diff(${details})`;
}

export function formatEvidenceLine(evidence: Evidence): EvidenceDisplay {
  if (evidence.evidenceType === 'command_output' || evidence.evidenceType === 'test_run') {
    return summarizeCommandOutput(evidence);
  }

  if (evidence.evidenceType === 'file_diff') {
    return {
      severity: 'neutral',
      text: `* ${summarizeFileDiff(evidence.payload as Record<string, unknown>)}`
    };
  }

  return {
    severity: 'neutral',
    text: `* ${evidence.evidenceType}`
  };
}
