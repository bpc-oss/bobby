import type { KernelEvent } from '@bobby/shared';

import type { SessionMeta, Usage } from '../client';

export interface ScriptStep {
  afterMs: number;
  emit:
    | { kind: 'kernel'; event: KernelEvent }
    | { kind: 'usage'; usage: Usage };
}

export interface SessionScript {
  meta: SessionMeta;
  steps: ScriptStep[];
  listOnly?: boolean;
}

const k = (event: KernelEvent): ScriptStep['emit'] => ({ kind: 'kernel', event });
const u = (usage: Usage): ScriptStep['emit'] => ({ kind: 'usage', usage });

const chatBasic: SessionScript = {
  meta: {
    id: 'chat-basic',
    mode: 'chat',
    title: 'New Chat',
    pinned: false,
    status: 'idle',
    updatedAt: '2026-06-13T10:00:00.000Z'
  },
  steps: [
    {
      afterMs: 400,
      emit: k({
        type: 'direct_answer',
        taskId: 't-chat-1',
        text: 'pnpm workspace 的依赖提升由 .npmrc 的 shamefully-hoist 与 public-hoist-pattern 控制……（mock 回答）'
      })
    },
    {
      afterMs: 200,
      emit: u({ inputTokens: 850, outputTokens: 420, cacheHitRate: 0.62, cny: 0.01 })
    },
    {
      afterMs: 100,
      emit: k({ type: 'final_result', taskId: 't-chat-1', status: 'done' })
    }
  ]
};

const codeGateEvidence: SessionScript = {
  meta: {
    id: 'code-gate',
    mode: 'code',
    title: '修复 updater 校验失败',
    project: 'bobby',
    branch: 'fix/updater-sig',
    pinned: false,
    status: 'idle',
    updatedAt: '2026-06-13T11:00:00.000Z'
  },
  steps: [
    {
      afterMs: 300,
      emit: k({
        type: 'plan_ready',
        taskId: 't-code-1',
        steps: [
          {
            id: 's1',
            desc: '复现校验失败并取证',
            satisfiesAcIds: ['ac1'],
            dependsOn: []
          },
          {
            id: 's2',
            desc: '定位 latest.yml 签名字段缺失',
            satisfiesAcIds: ['ac1'],
            dependsOn: ['s1']
          },
          {
            id: 's3',
            desc: '修改 electron-builder.yml 并重新打包验证',
            satisfiesAcIds: ['ac1', 'ac2'],
            dependsOn: ['s2']
          },
          {
            id: 's4',
            desc: 'Pro 复核 + 产出证据报告',
            satisfiesAcIds: ['ac1'],
            dependsOn: ['s3']
          }
        ]
      })
    },
    { afterMs: 200, emit: k({ type: 'step_started', taskId: 't-code-1', stepId: 's1' }) },
    {
      afterMs: 300,
      emit: k({ type: 'tool_called', taskId: 't-code-1', stepId: 's1', tool: 'read_file' })
    },
    { afterMs: 400, emit: k({ type: 'step_started', taskId: 't-code-1', stepId: 's3' }) },
    {
      afterMs: 300,
      emit: k({
        type: 'gate_request',
        taskId: 't-code-1',
        gateId: 'g1',
        reason:
          '修改 packages/gui/electron-builder.yml（+3 / -1）并执行 pnpm --filter @bobby/gui package'
      })
    },
    {
      afterMs: 500,
      emit: k({
        type: 'evidence_produced',
        taskId: 't-code-1',
        evidence: {
          claimId: 'c1',
          acId: 'ac1',
          evidenceType: 'command_output',
          payload: {
            command: 'pnpm --filter @bobby/gui package',
            exitCode: 0,
            stdout: '✓ built in 42.3s · latest.yml sha512 字段已生成'
          },
          producedBy: 'tool'
        }
      })
    },
    {
      afterMs: 300,
      emit: k({
        type: 'evidence_produced',
        taskId: 't-code-1',
        evidence: {
          claimId: 'c1',
          acId: 'ac2',
          evidenceType: 'file_diff',
          payload: {
            path: 'packages/gui/electron-builder.yml',
            plus: 3,
            minus: 1,
            diff: '+ generateUpdatesFilesForAllChannels: true\n+ verifyUpdateCodeSignature: true'
          },
          producedBy: 'tool'
        }
      })
    },
    {
      afterMs: 400,
      emit: k({
        type: 'verdict',
        taskId: 't-code-1',
        verdict: {
          claimId: 'c1',
          acId: 'ac1',
          result: 'pass',
          oracleTier: 'T2',
          detail: 'Pro 复核：sha512 校验链完整'
        }
      })
    },
    {
      afterMs: 200,
      emit: u({ inputTokens: 8100, outputTokens: 4200, cacheHitRate: 0.92, cny: 0.18 })
    },
    {
      afterMs: 100,
      emit: k({ type: 'final_result', taskId: 't-code-1', status: 'done' })
    }
  ]
};

const loopConverge: SessionScript = {
  meta: {
    id: 'loop-converge',
    mode: 'code',
    title: 'Loop: 单测覆盖率达到 90%',
    project: 'bobby',
    branch: 'loop/coverage',
    pinned: false,
    status: 'idle',
    updatedAt: '2026-06-13T09:00:00.000Z'
  },
  steps: [
    { afterMs: 200, emit: k({ type: 'step_started', taskId: 't-loop-1', stepId: 'iter-1' }) },
    {
      afterMs: 300,
      emit: k({
        type: 'verdict',
        taskId: 't-loop-1',
        verdict: {
          claimId: 'lc1',
          acId: 'cov',
          result: 'fail',
          oracleTier: 'T1',
          detail: '第 1 轮：覆盖率 71% < 90%'
        }
      })
    },
    { afterMs: 200, emit: k({ type: 'step_started', taskId: 't-loop-1', stepId: 'iter-2' }) },
    {
      afterMs: 300,
      emit: k({
        type: 'verdict',
        taskId: 't-loop-1',
        verdict: {
          claimId: 'lc1',
          acId: 'cov',
          result: 'fail',
          oracleTier: 'T1',
          detail: '第 2 轮：覆盖率 84% < 90%'
        }
      })
    },
    { afterMs: 200, emit: k({ type: 'step_started', taskId: 't-loop-1', stepId: 'iter-3' }) },
    {
      afterMs: 300,
      emit: k({
        type: 'verdict',
        taskId: 't-loop-1',
        verdict: {
          claimId: 'lc1',
          acId: 'cov',
          result: 'pass',
          oracleTier: 'T1',
          detail: '第 3 轮：覆盖率 92% ≥ 90%，收敛'
        }
      })
    },
    {
      afterMs: 200,
      emit: u({ inputTokens: 21000, outputTokens: 9800, cacheHitRate: 0.88, cny: 0.46 })
    },
    {
      afterMs: 100,
      emit: k({ type: 'final_result', taskId: 't-loop-1', status: 'done' })
    }
  ]
};

const multiSession: SessionScript = {
  meta: {
    id: 'multi-1',
    mode: 'code',
    title: 'kernel 事件总线单测补全',
    project: 'bobby',
    branch: 'main',
    pinned: false,
    status: 'done',
    updatedAt: '2026-06-13T03:20:00.000Z'
  },
  steps: [],
  listOnly: true
};

export const FIXTURES: Record<string, SessionScript> = {
  'chat-basic': chatBasic,
  'code-gate-evidence': codeGateEvidence,
  'loop-converge': loopConverge,
  'multi-session': multiSession
};
