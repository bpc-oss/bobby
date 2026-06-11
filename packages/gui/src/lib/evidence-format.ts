import type { Evidence } from '@bobby/shared';

export interface PlainEvidence {
  summary: string;
  ok: boolean;
  detail: string;
}

function stringifyPayload(payload: Record<string, unknown>): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return '[unserializable payload]';
  }
}

function commandOutputSummary(exitCode: unknown): string {
  if (typeof exitCode === 'number' && exitCode === 0) {
    return '命令运行成功';
  }

  return `命令执行失败 (${typeof exitCode === 'number' ? `exitCode: ${exitCode}` : '未返回退出码'})`;
}

function commandOutputDetail(payload: Record<string, unknown>): string {
  const stdout = payload.stdout;
  const stderr = payload.stderr;

  if (typeof stdout === 'string' && stdout.length > 0) {
    return `stdout: ${stdout}`;
  }

  if (typeof stderr === 'string' && stderr.length > 0) {
    return `stderr: ${stderr}`;
  }

  return stringifyPayload(payload);
}

function fileExistsSummary(exists: unknown): string {
  if (exists === true) {
    return '文件已生成';
  }

  return '文件未生成或未确认存在';
}

function fileExistsDetail(payload: Record<string, unknown>): string {
  if (typeof payload.path === 'string' && payload.path.length > 0) {
    return `path: ${payload.path}`;
  }

  return stringifyPayload(payload);
}

function fileDiffSummary(payload: Record<string, unknown>): string {
  if (typeof payload.path === 'string' && payload.path.length > 0) {
    return `已修改文件: ${payload.path}`;
  }

  return '文件已修改';
}

function fileDiffDetail(payload: Record<string, unknown>): string {
  const path = typeof payload.path === 'string' && payload.path.length > 0 ? `path: ${payload.path}` : '';
  const rawDiff =
    typeof payload.patch === 'string' && payload.patch.length > 0
      ? payload.patch
      : typeof payload.diff === 'string' && payload.diff.length > 0
        ? payload.diff
        : typeof payload.content === 'string' && payload.content.length > 0
          ? payload.content
          : '';
  const diff = rawDiff ? `diff: ${rawDiff}` : '';

  if (path && diff) {
    return `${path}\n${diff}`;
  }

  if (path || diff) {
    return path || diff;
  }

  return stringifyPayload(payload);
}

type EvidencePayloadFormatter = (payload: Record<string, unknown>) => PlainEvidence;

const formatByEvidenceType: Partial<Record<Evidence['evidenceType'], EvidencePayloadFormatter>> = {
  command_output: (payload) => {
    const exitCode = (payload as { exitCode?: unknown }).exitCode;
    return {
      summary: commandOutputSummary(exitCode),
      ok: exitCode === 0,
      detail: commandOutputDetail(payload),
    };
  },
  file_exists: (payload) => {
    const exists = (payload as { exists?: unknown }).exists;
    return {
      summary: fileExistsSummary(exists),
      ok: exists === true,
      detail: fileExistsDetail(payload),
    };
  },
  file_diff: (payload) => ({
    summary: fileDiffSummary(payload),
    ok: true,
    detail: fileDiffDetail(payload),
  }),
  pro_review: (payload) => {
    const verdict = (payload as { verdict?: unknown }).verdict;
    const result = (payload as { result?: unknown }).result;
    return {
      summary: 'AI 审核证据',
      ok: verdict !== 'fail' && result !== 'fail',
      detail: stringifyPayload(payload),
    };
  },
  quote_with_location: (payload) => ({
    summary: '已完成逐项核对，包含引用位置',
    ok: true,
    detail: stringifyPayload(payload),
  }),
};

export function toPlainLanguage(ev: Evidence): PlainEvidence {
  const payload = ev.payload as Record<string, unknown>;
  const formatter = formatByEvidenceType[ev.evidenceType];
  if (formatter) {
    return formatter(payload);
  }

  return {
    summary: `证据类型: ${ev.evidenceType}`,
    ok: true,
    detail: stringifyPayload(payload),
  };
}
