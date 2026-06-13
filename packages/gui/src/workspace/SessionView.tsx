import React from 'react';
import type { PlanStep } from '@bobby/shared';

import { getKernelClient } from '../kernel';
import { emptyUsage } from '../kernel/client';
import type { Usage } from '../kernel/client';
import { findProjectById } from '../shell/project-catalog';
import { useSessionStore } from '../store/session-store';
import type { TimelineItem } from '../store/session-store';
import type { AppMode } from '../store/ui-store';
import { useUiStore } from '../store/ui-store';
import { Composer } from './Composer';
import { SummaryBar } from './SummaryBar';
import { TimelineCard } from './TimelineCards';
import { UsageBar } from './UsageBar';

const EMPTY_TIMELINE: TimelineItem[] = [];
const EMPTY_PLAN: PlanStep[] = [];
const EMPTY_USAGE = emptyUsage();
const PREVIEW_SUMMARY = { files: 2, evidence: 3, cost: '¥0.42' };
const PREVIEW_PLAN: PlanStep[] = [
  { id: 's1', desc: '复现签名校验失败并收集日志证据', satisfiesAcIds: [], dependsOn: [] },
  { id: 's2', desc: '定位 latest.yml 缺失的签名字段', satisfiesAcIds: [], dependsOn: ['s1'] },
  { id: 's3', desc: '修正打包配置并重新验收', satisfiesAcIds: [], dependsOn: ['s2'] },
  { id: 's4', desc: '整理复核结论并输出证据', satisfiesAcIds: [], dependsOn: ['s3'] }
];
const PREVIEW_TIMELINE: TimelineItem[] = [
  { kind: 'user', text: '更新器提示 signature validation failed，帮我查一下并修复。' },
  { kind: 'kernel', event: { type: 'tool_called', taskId: 'preview', stepId: 's1', tool: 'read_file' } },
  {
    kind: 'kernel',
    event: {
      type: 'direct_answer',
      taskId: 'preview',
      text: '已经定位到原因：latest.yml 缺少 sha512 签名字段。我需要修改 electron-builder.yml 并重新打包验证。'
    }
  },
  {
    kind: 'kernel',
    event: {
      type: 'gate_request',
      taskId: 'preview',
      gateId: 'preview-gate',
      reason: '修改 packages/gui/electron-builder.yml 并执行 pnpm --filter @bobby/gui package'
    }
  },
  {
    kind: 'kernel',
    event: {
      type: 'evidence_produced',
      taskId: 'preview',
      evidence: {
        claimId: 'preview-c1',
        acId: 'ac1',
        evidenceType: 'command_output',
        payload: {
          command: 'pnpm --filter @bobby/gui package',
          exitCode: 0,
          stdout: 'built in 42.3s / latest.yml sha512 字段已生成'
        },
        producedBy: 'tool'
      }
    }
  }
];
const PREVIEW_USAGE: Usage = { inputTokens: 8100, outputTokens: 4200, cacheHitRate: 0.92, cny: 0.18 };
const LOOP_PREVIEW_TIMELINE: TimelineItem[] = [
  {
    kind: 'kernel',
    event: {
      type: 'verdict',
      taskId: 'loop-preview',
      verdict: {
        claimId: 'loop-c1',
        acId: 'cov',
        result: 'fail',
        oracleTier: 'T1',
        detail: 'Round 1: coverage 71% < 90%'
      }
    }
  },
  {
    kind: 'kernel',
    event: {
      type: 'verdict',
      taskId: 'loop-preview',
      verdict: {
        claimId: 'loop-c1',
        acId: 'cov',
        result: 'fail',
        oracleTier: 'T1',
        detail: 'Round 2: coverage 84% < 90%'
      }
    }
  },
  {
    kind: 'kernel',
    event: {
      type: 'verdict',
      taskId: 'loop-preview',
      verdict: {
        claimId: 'loop-c1',
        acId: 'cov',
        result: 'pass',
        oracleTier: 'T1',
        detail: 'Round 3: coverage 92% >= 90%, converged'
      }
    }
  }
];
const LOOP_PREVIEW_USAGE: Usage = { inputTokens: 21000, outputTokens: 9800, cacheHitRate: 0.88, cny: 0.46 };

function deriveSessionTitle(input: string, fallback: string): string {
  const singleLine = input.replace(/\s+/g, ' ').trim();
  if (!singleLine) return fallback;
  return singleLine.length > 48 ? `${singleLine.slice(0, 45).trimEnd()}...` : singleLine;
}

interface SessionRuntime {
  session?: ReturnType<typeof useSessionStore.getState>['sessions'][string];
  currentStepId?: string;
  pendingGate?: ReturnType<typeof useSessionStore.getState>['pendingGates'][string];
  summaryOpen: boolean;
  showSummary: boolean;
  stage: {
    preview: boolean;
    plan: PlanStep[];
    timeline: TimelineItem[];
    usage: Usage;
  };
  onToggleSummary: () => void;
  onSubmit: (input: string) => Promise<void>;
  onGateDecision: (gateId: string, decision: 'allow' | 'deny') => void;
}

function SessionHeader({
  title,
  branch,
  projectName,
  showSummary,
  summaryOpen,
  onToggle,
  lang
}: {
  title: string;
  branch?: string;
  projectName?: string;
  showSummary: boolean;
  summaryOpen: boolean;
  onToggle: () => void;
  lang: 'zh' | 'en';
}): JSX.Element {
  return (
    <div className={`ws-top ${branch ? 'ws-top-branch' : ''} ${showSummary ? 'ws-top-with-summary' : ''}`}>
      <div className="ws-title-block">
        <span className="ws-title">{title}</span>
        {projectName ? <span className="ws-context-pill">{projectName}</span> : null}
        {branch ? <span className="git-chip">≋ {branch}</span> : null}
      </div>
      {showSummary ? (
        <button
          className={`summary-toggle ${summaryOpen ? 'open' : ''}`}
          type="button"
          aria-label={lang === 'zh' ? '切换摘要栏' : 'Toggle summary rail'}
          onClick={onToggle}
        >
          <span className="summary-toggle-ic" aria-hidden>
            ⊕
          </span>
          <span>{lang === 'zh' ? '摘要' : 'Summary'}</span>
        </button>
      ) : null}
    </div>
  );
}

function SessionStream({
  items,
  pendingGateId,
  onGateDecision,
  preview = false,
  rightRailOpen = false,
  summaryOpen = false
}: {
  items: TimelineItem[];
  pendingGateId?: string;
  onGateDecision: (gateId: string, decision: 'allow' | 'deny') => void;
  preview?: boolean;
  rightRailOpen?: boolean;
  summaryOpen?: boolean;
}): JSX.Element {
  return (
    <div
      className={[
        'stream',
        preview ? 'preview-stream' : '',
        rightRailOpen ? 'stream-rail-open' : '',
        summaryOpen ? 'stream-summary-open' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {items.map((item, index) => (
        <TimelineCard
          key={index}
          item={item}
          onGateDecision={onGateDecision}
          gatePending={item.kind === 'kernel' && item.event.type === 'gate_request' && pendingGateId === item.event.gateId}
        />
      ))}
    </div>
  );
}

function DraftStarter({
  title,
  desc,
  prompts,
  compact = false
}: {
  title: string;
  desc: string;
  prompts: string[];
  compact?: boolean;
}): JSX.Element {
  return (
    <div className={`draft-stage ${compact ? 'draft-stage-compact' : ''}`}>
      <div className="draft-stage-copy">
        <span className="draft-stage-kicker">Bobby</span>
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
      <div className="draft-stage-grid">
        {prompts.map((prompt) => (
          <button key={prompt} className="draft-stage-card" type="button">
            <span className="draft-stage-card-ic" aria-hidden>
              {'>'}
            </span>
            <span>{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExistingSessionIdleState({
  title,
  desc
}: {
  title: string;
  desc: string;
}): JSX.Element {
  return (
    <div className="idle-session-stage">
      <div className="idle-session-copy">
        <span className="idle-session-kicker">Ready</span>
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
    </div>
  );
}

function EmptySessionStream({ mode, compact = false, lang }: { mode: AppMode; compact?: boolean; lang: 'zh' | 'en' }): JSX.Element {
  const isCode = mode === 'code';

  return (
    <DraftStarter
      title={isCode ? (lang === 'zh' ? '开始一个代码会话' : 'Start a code session') : lang === 'zh' ? '开始一个对话' : 'Start a chat'}
      desc={
        isCode
          ? lang === 'zh'
            ? '先在下方选择项目上下文，或者保持全局模式。只有真正发送任务后，才会生成这条 session。'
            : 'Choose a project context below or keep it global. A thread is only created after you send the first task.'
          : lang === 'zh'
            ? '这个 GUI 默认是全局壳层。你可以把会话挂到某个项目，也可以保持为通用线程。'
            : 'This GUI starts as a global shell. You can attach the session to a project or keep it as a general thread.'
      }
      prompts={
        isCode
          ? lang === 'zh'
            ? ['检查这个仓库最值得先修的问题', '解释这个报错并给出最小修复方案', '先审一遍最近改动的风险点']
            : ['Inspect the most urgent issue in this repo', 'Explain this error and propose the smallest fix', 'Review the recent changes for risk first']
          : lang === 'zh'
            ? ['帮我梳理这个项目下一步该做什么', '把这段需求改写成可执行任务', '总结当前工作区里和 GUI 相关的重点']
            : ['Outline the next step for this project', 'Rewrite this request into an executable task', 'Summarize the key GUI context in this workspace']
      }
      compact={compact}
    />
  );
}

function SessionBody({
  mode,
  draftTitle,
  runtime,
  rightRailOpen,
  lang,
  projectName
}: {
  mode: AppMode;
  draftTitle: string;
  runtime: SessionRuntime;
  rightRailOpen: boolean;
  lang: 'zh' | 'en';
  projectName?: string;
}): JSX.Element {
  const showWorkspaceSelector = mode === 'code' && !runtime.session;

  return (
    <>
      <SessionHeader
        title={runtime.session?.title ?? draftTitle}
        branch={runtime.session?.branch}
        projectName={runtime.session?.project ?? projectName}
        showSummary={runtime.showSummary}
        summaryOpen={runtime.summaryOpen}
        onToggle={runtime.onToggleSummary}
        lang={lang}
      />
      {runtime.showSummary ? (
        <SummaryBar
          steps={runtime.stage.plan}
          currentStepId={runtime.currentStepId}
          timeline={runtime.stage.timeline}
          usage={runtime.stage.usage}
          status={runtime.session?.status}
          preview={runtime.stage.preview}
          branch={runtime.session?.branch}
          agents={runtime.session?.agents}
          browsers={runtime.session?.browsers}
          sources={runtime.session?.sources}
          previewStats={runtime.stage.preview ? PREVIEW_SUMMARY : undefined}
        />
      ) : null}
      {runtime.stage.timeline.length > 0 ? (
        <SessionStream
          items={runtime.stage.timeline}
          pendingGateId={runtime.pendingGate?.gateId}
          onGateDecision={runtime.onGateDecision}
          preview={runtime.stage.preview}
          rightRailOpen={rightRailOpen}
          summaryOpen={runtime.summaryOpen}
        />
      ) : runtime.session ? (
        <div className="stream stream-empty">
          <ExistingSessionIdleState
            title={lang === 'zh' ? '等待首个任务' : 'This session is ready for the first task.'}
            desc={
              mode === 'code'
                ? lang === 'zh'
                  ? '这个 session 已经存在，但还没有真正开跑。直接在下方输入任务，它会继续挂在当前项目上下文里，或保持全局通用。'
                  : 'This session already exists but has not started yet. Send the first task below and it will stay attached to the current project context or remain global.'
                : lang === 'zh'
                  ? '这个对话已经创建，但还没有首条消息。直接在下方输入内容即可开始。'
                  : 'This chat already exists but has no first message yet. Send the first message below to begin.'
            }
          />
        </div>
      ) : (
        <div className="stream stream-empty">
          <EmptySessionStream mode={mode} compact={rightRailOpen} lang={lang} />
        </div>
      )}
      <div className={`composer-wrap ${runtime.stage.preview ? 'preview-composer-wrap' : ''}`}>
        <Composer
          mode={mode}
          onSubmit={(input) => void runtime.onSubmit(input)}
          disabled={Boolean(runtime.pendingGate)}
          showWorkspaceSelector={showWorkspaceSelector}
        />
        <UsageBar usage={runtime.stage.usage} />
      </div>
    </>
  );
}

function useSessionData(sessionId: string | undefined) {
  const session = useSessionStore((state) => (sessionId ? state.sessions[sessionId] : undefined));
  const timeline = useSessionStore((state) => (sessionId ? state.timelines[sessionId] : undefined));
  const usage = useSessionStore((state) => (sessionId ? state.usages[sessionId] : undefined));
  const plan = useSessionStore((state) => (sessionId ? state.plans[sessionId] : undefined));
  const currentStepId = useSessionStore((state) => (sessionId ? state.currentStepIds[sessionId] : undefined));
  const pendingGate = useSessionStore((state) => (sessionId ? state.pendingGates[sessionId] : undefined));
  return { session, timeline, usage, plan, currentStepId, pendingGate };
}

function useSessionRuntime(sessionId: string | undefined, mode: AppMode): SessionRuntime {
  const { session, timeline, usage, plan, currentStepId, pendingGate } = useSessionData(sessionId);
  const addUserMessage = useSessionStore((state) => state.addUserMessage);
  const setSessions = useSessionStore((state) => state.setSessions);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const currentProjectId = useUiStore((state) => state.currentProjectId);
  const summaryOpen = useUiStore((state) => state.summaryOpen);
  const onToggleSummary = useUiStore((state) => state.toggleSummary);
  const selectedProject = findProjectById(currentProjectId);
  const preview = sessionId === 'code-gate' && !(timeline?.length ?? 0);
  const loopPreview = sessionId === 'loop-converge' && !(timeline?.length ?? 0);
  const stage = {
    preview,
    plan: preview ? PREVIEW_PLAN : (plan ?? EMPTY_PLAN),
    timeline: preview ? PREVIEW_TIMELINE : loopPreview ? LOOP_PREVIEW_TIMELINE : (timeline ?? EMPTY_TIMELINE),
    usage: preview ? PREVIEW_USAGE : loopPreview ? LOOP_PREVIEW_USAGE : (usage ?? EMPTY_USAGE)
  };
  const showSummary = Boolean(session) || stage.timeline.length > 0 || stage.plan.length > 0 || Boolean(currentStepId) || Boolean(pendingGate);

  const onSubmit = React.useCallback(
    async (input: string): Promise<void> => {
      if (sessionId) {
        addUserMessage(sessionId, input);
        await getKernelClient().startTask(sessionId, input);
        return;
      }

      const created = await getKernelClient().createSession(mode);
      setSessions([
        {
          ...created,
          title: deriveSessionTitle(input, created.title),
          project: mode === 'code' ? selectedProject?.name : undefined
        }
      ]);
      setActiveSession(created.id);
      addUserMessage(created.id, input);
      await getKernelClient().startTask(created.id, input);
    },
    [addUserMessage, mode, selectedProject?.name, sessionId, setActiveSession, setSessions]
  );

  const onGateDecision = React.useCallback(
    (gateId: string, decision: 'allow' | 'deny'): void => {
      if (!sessionId) return;
      void getKernelClient().approveGate(sessionId, gateId, decision);
    },
    [sessionId]
  );

  return {
    session,
    currentStepId,
    pendingGate,
    summaryOpen,
    showSummary,
    stage,
    onToggleSummary,
    onSubmit,
    onGateDecision
  };
}

export function SessionView({ sessionId, mode }: { sessionId?: string; mode: AppMode }): JSX.Element {
  const runtime = useSessionRuntime(sessionId, mode);
  const lang = useUiStore((state) => state.lang);
  const rightRailOpen = useUiStore((state) => state.rightPanelOpen);
  const currentProject = findProjectById(useUiStore((state) => state.currentProjectId));
  const draftTitle = mode === 'chat' ? (lang === 'zh' ? '新对话' : 'New Chat') : lang === 'zh' ? '新会话' : 'New Session';

  return (
    <div className={`session-view session-stage ${rightRailOpen ? 'session-with-right-rail' : ''}`}>
      <SessionBody
        mode={mode}
        draftTitle={draftTitle}
        runtime={runtime}
        rightRailOpen={rightRailOpen}
        lang={lang}
        projectName={currentProject?.name}
      />
    </div>
  );
}
