import type { PlanStep } from '@bobby/shared';
import React from 'react';

import type {
  SessionLinkedAgent,
  SessionLinkedBrowser,
  SessionLinkedSource,
  SessionStatus,
  Usage
} from '../kernel/client';
import type { TimelineItem } from '../store/session-store';
import { useUiStore } from '../store/ui-store';

interface SummaryBarProps {
  steps: PlanStep[];
  currentStepId?: string;
  timeline?: TimelineItem[];
  usage?: Usage;
  status?: SessionStatus;
  preview?: boolean;
  branch?: string;
  agents?: SessionLinkedAgent[];
  browsers?: SessionLinkedBrowser[];
  sources?: SessionLinkedSource[];
  previewStats?: {
    files: number;
    evidence: number;
    cost: string;
  };
}

interface SummaryMetrics {
  files: number;
  evidence: number;
  cost: string;
}

interface SummaryProgressEntry {
  id: string;
  text: string;
  state: 'done' | 'current' | 'idle';
}

function isDone(step: PlanStep, currentStepId?: string): boolean {
  if (!currentStepId || step.id === currentStepId) return false;
  return step.dependsOn.includes(currentStepId) || step.id < currentStepId;
}

function resolveMetrics(
  steps: PlanStep[],
  timeline: TimelineItem[],
  usage: Usage | undefined,
  previewStats?: SummaryBarProps['previewStats']
): SummaryMetrics {
  const fileEvidenceCount = timeline.filter(
    (item) =>
      item.kind === 'kernel' &&
      item.event.type === 'evidence_produced' &&
      item.event.evidence.evidenceType === 'file_diff'
  ).length;
  const evidenceCount = timeline.filter(
    (item) => item.kind === 'kernel' && (item.event.type === 'evidence_produced' || item.event.type === 'verdict')
  ).length;

  return {
    files: previewStats?.files ?? Math.max(steps.length, fileEvidenceCount),
    evidence: previewStats?.evidence ?? Math.max(Math.max(steps.length - 1, 0), evidenceCount),
    cost: previewStats?.cost ?? `¥${(usage?.cny ?? 0).toFixed(2)}`
  };
}

function deriveProgressEntries(
  steps: PlanStep[],
  currentStepId: string | undefined,
  timeline: TimelineItem[],
  status: SessionStatus | undefined
): SummaryProgressEntry[] {
  if (steps.length > 0) {
    return steps.map((step) => ({
      id: step.id,
      text: step.desc,
      state: step.id === currentStepId ? 'current' : isDone(step, currentStepId) ? 'done' : 'idle'
    }));
  }

  return timeline
    .filter((item): item is Extract<TimelineItem, { kind: 'kernel' }> => item.kind === 'kernel')
    .filter(
      (
        item
      ): item is Extract<TimelineItem, { kind: 'kernel' }> & {
        event: Extract<Extract<TimelineItem, { kind: 'kernel' }>['event'], { type: 'verdict' }>;
      } => item.event.type === 'verdict' && Boolean(item.event.verdict.detail?.trim())
    )
    .map<SummaryProgressEntry>((item, index, list) => ({
      id: `verdict-${index}`,
      text: item.event.verdict.detail?.trim() ?? '',
      state: index === list.length - 1 ? (status === 'done' || status === 'failed' ? 'done' : 'current') : 'done'
    }))
    .slice(-4);
}

function SummaryEnvironment({
  branch,
  metrics,
  lang
}: {
  branch?: string;
  metrics: SummaryMetrics;
  lang: 'zh' | 'en';
}): JSX.Element {
  return (
    <section className="summary-section">
      <div className="summary-section-title">
        <span>{lang === 'zh' ? '环境信息' : 'Environment'}</span>
        <span className="summary-gear" aria-hidden>
          ⚙
        </span>
      </div>
      <div className="summary-meta-list">
        <div className="summary-meta-item">
          <span className="summary-meta-ic" aria-hidden>
            ⊕
          </span>
          <span>{lang === 'zh' ? '变更' : 'Changes'}</span>
          <span className="summary-meta-tail">{metrics.files}</span>
        </div>
        <div className="summary-meta-item">
          <span className="summary-meta-ic" aria-hidden>
            ⌘
          </span>
          <span>{lang === 'zh' ? '本地' : 'Local'}</span>
        </div>
        <div className="summary-meta-item">
          <span className="summary-meta-ic" aria-hidden>
            ≋
          </span>
          <span>{branch ?? 'master'}</span>
        </div>
        <div className="summary-meta-item">
          <span className="summary-meta-ic" aria-hidden>
            ✓
          </span>
          <span>{lang === 'zh' ? `证据 ${metrics.evidence}` : `Evidence ${metrics.evidence}`}</span>
          <span className="summary-meta-tail">{metrics.cost}</span>
        </div>
      </div>
    </section>
  );
}

function SummaryProgress({
  entries,
  open,
  lang
}: {
  entries: SummaryProgressEntry[];
  open: boolean;
  lang: 'zh' | 'en';
}): JSX.Element {
  const visibleEntries = open ? entries : entries.slice(0, Math.min(3, entries.length));

  return (
    <section className="summary-section">
      <div className="summary-section-title">
        <span>{lang === 'zh' ? '进度' : 'Progress'}</span>
      </div>
      <div className="summary-progress-list">
        {visibleEntries.length === 0 ? (
          <div className="summary-progress-item idle">
            <span className="summary-dot" aria-hidden />
            <span>
              {lang === 'zh'
                ? '暂无计划，任务开始后这里会显示步骤收敛情况。'
                : 'No plan yet. This rail will show step convergence once work starts.'}
            </span>
          </div>
        ) : null}
        {visibleEntries.map((entry) => (
          <div key={entry.id} className={`summary-progress-item ${entry.state}`}>
            <span className="summary-dot" aria-hidden />
            <span>{entry.text}</span>
          </div>
        ))}
        {!open && entries.length > visibleEntries.length ? (
          <div className="summary-more">
            {lang === 'zh'
              ? `展开后可继续查看其余 ${entries.length - visibleEntries.length} 步。`
              : `Expand to see the remaining ${entries.length - visibleEntries.length} steps.`}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SummaryLinkedSection({
  title,
  items,
  icon
}: {
  title: string;
  items: { label: string; detail?: string }[];
  icon: string;
}): JSX.Element | null {
  if (items.length === 0) return null;

  const [open, setOpen] = React.useState(false);

  return (
    <section className="summary-section">
      <button
        type="button"
        className={`summary-linked-toggle ${open ? 'open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="summary-section-title summary-section-title-linked">
          <span>{title}</span>
          <span className="summary-linked-arrow" aria-hidden>
            {open ? '⌄' : '›'}
          </span>
        </span>
      </button>
      {open ? (
        <div className="summary-linked-list">
          {items.map((item) => (
            <div key={`${title}-${item.label}`} className="summary-linked-item">
              <span className="summary-linked-ic" aria-hidden>
                {icon}
              </span>
              <div className="summary-linked-copy">
                <span className="summary-linked-label">{item.label}</span>
                {item.detail ? <span className="summary-linked-detail">{item.detail}</span> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function SummaryBar({
  steps,
  currentStepId,
  timeline = [],
  usage,
  status,
  preview = false,
  branch,
  agents = [],
  browsers = [],
  sources = [],
  previewStats
}: SummaryBarProps): JSX.Element {
  const lang = useUiStore((state) => state.lang);
  const open = useUiStore((state) => state.summaryOpen);
  const rightRailOpen = useUiStore((state) => state.rightPanelOpen);
  const metrics = resolveMetrics(steps, timeline, usage, previewStats);
  const progressEntries = deriveProgressEntries(steps, currentStepId, timeline, status);

  return (
    <div
      className={`summary ${open ? 'open' : ''} ${preview ? 'summary-preview' : ''} ${rightRailOpen ? 'summary-with-right-rail' : ''}`}
      aria-hidden={!open}
    >
      <aside className="summary-panel">
        <SummaryEnvironment branch={branch} metrics={metrics} lang={lang} />
        <SummaryProgress entries={progressEntries} open={open} lang={lang} />
        <SummaryLinkedSection
          title={lang === 'zh' ? `子智能体 ${agents.length}` : `Subagents ${agents.length}`}
          items={agents.map((item) => ({ label: item.name, detail: item.detail }))}
          icon="⌘"
        />
        <SummaryLinkedSection
          title={lang === 'zh' ? `浏览器 ${browsers.length}` : `Browser ${browsers.length}`}
          items={browsers}
          icon="◌"
        />
        <SummaryLinkedSection
          title={lang === 'zh' ? `来源 ${sources.length}` : `Sources ${sources.length}`}
          items={sources}
          icon="◎"
        />
      </aside>
    </div>
  );
}
