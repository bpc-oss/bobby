import React from 'react';

import type { TimelineItem } from '../store/session-store';
import { useSessionStore } from '../store/session-store';
import { useUiStore } from '../store/ui-store';

type DiffRow = { path: string; marker: 'A' | 'M'; diff: string[] };
type EvidenceRow = { evidenceType: string; detail: string };

const PREVIEW_DIFFS: DiffRow[] = [
  {
    path: 'packages/gui/electron-builder.yml',
    marker: 'M',
    diff: [
      '@@ electron-builder.yml @@',
      '-  # publish section trimmed incorrectly',
      '+  generateUpdatesFilesForAllChannels: true',
      '+  verifyUpdateCodeSignature: true'
    ]
  },
  {
    path: 'packages/gui/scripts/verify-sig.mjs',
    marker: 'A',
    diff: []
  }
];

const PREVIEW_EVIDENCE: EvidenceRow[] = [
  { evidenceType: 'command_output', detail: 'built in 42.3s / latest.yml sha512 generated' },
  { evidenceType: 'file_diff', detail: 'electron-builder.yml +3 / -1' },
  { evidenceType: 'file_exists', detail: 'release/latest.yml' }
];

function getEvidenceItems(timeline: TimelineItem[]) {
  return timeline.flatMap((item) =>
    item.kind === 'kernel' && item.event.type === 'evidence_produced' ? [item.event.evidence] : []
  );
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function getEvidenceDetail(evidence: ReturnType<typeof getEvidenceItems>[number]): string {
  const payload = evidence.payload as Record<string, unknown>;

  if (evidence.evidenceType === 'command_output') {
    return normalizeText(payload.stdout, 'command output captured');
  }

  if (evidence.evidenceType === 'file_diff') {
    const path = normalizeText(payload.path, 'file diff');
    const plus = typeof payload.plus === 'number' ? payload.plus : undefined;
    const minus = typeof payload.minus === 'number' ? payload.minus : undefined;
    if (plus !== undefined || minus !== undefined) {
      return `${path} +${plus ?? 0} / -${minus ?? 0}`;
    }
    return path;
  }

  if (evidence.evidenceType === 'file_exists') {
    return normalizeText(payload.path, 'file exists');
  }

  return evidence.evidenceType;
}

function EmptyReviewState({ lang }: { lang: 'zh' | 'en' }): JSX.Element {
  return (
    <div className="rp-empty rp-empty-state review-empty-state">
      <div className="review-empty-orb" aria-hidden>
        ⊕
      </div>
      <h3>{lang === 'zh' ? '暂无审查内容' : 'No review content yet'}</h3>
      <p>
        {lang === 'zh'
          ? '会话产生文件变更或证据后，这里会显示变更列表、差异视图和证据时间线。'
          : 'Once the session produces file changes or evidence, this rail will show changes, diffs, and the evidence timeline.'}
      </p>
    </div>
  );
}

function buildDiffRows(preview: boolean, evidences: ReturnType<typeof getEvidenceItems>): DiffRow[] {
  if (preview) return PREVIEW_DIFFS;

  return evidences
    .filter((evidence) => evidence.evidenceType === 'file_diff')
    .map((evidence) => {
      const payload = evidence.payload as Record<string, unknown>;
      return {
        path: normalizeText(payload.path, 'unknown file'),
        marker: 'M' as const,
        diff: normalizeText(payload.diff, '')
          .split('\n')
          .filter(Boolean)
      };
    });
}

function buildEvidenceRows(preview: boolean, evidences: ReturnType<typeof getEvidenceItems>): EvidenceRow[] {
  if (preview) return PREVIEW_EVIDENCE;

  return evidences.map((evidence) => ({
    evidenceType: evidence.evidenceType,
    detail: getEvidenceDetail(evidence)
  }));
}

function ReviewToolbar({
  filesCount,
  lang
}: {
  filesCount: number;
  lang: 'zh' | 'en';
}): JSX.Element {
  return (
    <div className="review-toolbar">
      <button className="review-branch-trigger" type="button">
        {lang === 'zh' ? '分支' : 'Branch'} <span>▾</span>
      </button>
      <div className="review-toolbar-actions">
        <button className="review-toolbar-icon" aria-label={lang === 'zh' ? '更多操作' : 'More actions'} type="button">
          …
        </button>
        <button className="review-toolbar-icon" aria-label={lang === 'zh' ? '复制审查链接' : 'Copy review link'} type="button">
          ⧉
        </button>
        <button className="review-toolbar-icon" aria-label={lang === 'zh' ? '打开文件抽屉' : 'Open files rail'} type="button">
          ▣
        </button>
        <button className="review-toolbar-primary" type="button">
          {lang === 'zh' ? '提交或推送' : 'Commit or push'}
        </button>
        <button className="review-toolbar-secondary" type="button" disabled>
          {lang === 'zh' ? '创建拉取请求' : 'Create pull request'}
        </button>
      </div>
      <div className="review-filter">
        <span aria-hidden>⌕</span>
        <input readOnly value={filesCount > 0 ? (lang === 'zh' ? '筛选文件...' : 'Filter files...') : lang === 'zh' ? '等待文件变更...' : 'Waiting for file changes...'} />
      </div>
    </div>
  );
}

function ReviewBody({
  diffRows,
  evidenceRows,
  lang
}: {
  diffRows: DiffRow[];
  evidenceRows: EvidenceRow[];
  lang: 'zh' | 'en';
}): JSX.Element {
  return (
    <div className="review-panel">
      <ReviewToolbar filesCount={diffRows.length} lang={lang} />

      <section className="review-block">
        <div className="rp-sec-h">{lang === 'zh' ? `变更 · ${diffRows.length}` : `CHANGES · ${diffRows.length}`}</div>
        <div className="review-list">
          {diffRows.map((diff, index) => (
            <React.Fragment key={`${index}-${diff.path}`}>
              <div className="file-row review-row">
                <span className={`m ${diff.marker}`}>{diff.marker}</span>
                <span>{diff.path}</span>
              </div>
              {diff.diff.length > 0 ? (
                <div className="diff review-diff">
                  {diff.diff.map((line) => (
                    <div key={`${diff.path}-${line}`} className={line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : ''}>
                      {line}
                    </div>
                  ))}
                </div>
              ) : null}
            </React.Fragment>
          ))}
        </div>
      </section>

      <section className="review-block">
        <div className="rp-sec-h">{lang === 'zh' ? `证据 · ${evidenceRows.length}` : `EVIDENCE · ${evidenceRows.length}`}</div>
        <div className="review-list">
          {evidenceRows.map((evidence, index) => (
            <div className="evid-row review-row" key={`${index}-${evidence.evidenceType}`}>
              <span className="ck">✓</span>
              <span>
                {evidence.evidenceType}
                {evidence.detail ? ` · ${evidence.detail}` : ''}
              </span>
            </div>
          ))}
        </div>
      </section>

      <button className="review-btn" disabled title="P3" type="button">
        {lang === 'zh' ? '使用 Pro 复核本次变更' : 'Use Pro to review this change set'}
      </button>
    </div>
  );
}

export function ReviewPanel(): JSX.Element {
  const lang = useUiStore((state) => state.lang);
  const activeId = useSessionStore((state) => state.activeSessionId);
  const timeline = useSessionStore((state) => (activeId ? state.timelines[activeId] : undefined));
  const evidences = getEvidenceItems(timeline ?? []);
  const preview = activeId === 'code-gate' && evidences.length === 0;

  if (!preview && evidences.length === 0) {
    return <EmptyReviewState lang={lang} />;
  }

  return <ReviewBody diffRows={buildDiffRows(preview, evidences)} evidenceRows={buildEvidenceRows(preview, evidences)} lang={lang} />;
}
