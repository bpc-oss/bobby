import React from 'react';

import type { Evidence, KernelEvent, PlanStep } from '@bobby/shared';
import { makeKernelClient } from '../ipc/contract';
import { initial, reduce } from '../store/app-store';
import { PlanView } from '../components/PlanView';
import { ChatStream } from '../components/ChatStream';
import { EvidencePanel } from '../components/EvidencePanel';
import { GateDialog } from '../components/GateDialog';
import { CostBar } from '../components/CostBar';
import { ThemeToggle } from '../components/ThemeToggle';
import type { AppState as StoreState } from '../store/app-store';

type KernelClient = {
  startTask: (input: string) => Promise<unknown>;
  approveGate: (gateId: string, decision: 'allow' | 'deny') => Promise<unknown>;
  onEvent: (callback: (event: KernelEvent) => void) => () => void;
};

const fallbackClient: KernelClient = {
  startTask: async () => undefined,
  approveGate: async () => undefined,
  onEvent: () => () => undefined
};

function resolveKernelClient(): KernelClient {
  if (typeof window === 'undefined') {
    return fallbackClient;
  }

  if (((window as unknown as { bobby?: unknown }).bobby) !== undefined) {
    return makeKernelClient();
  }

  return fallbackClient;
}

interface WorkspaceProps {
  kernelClient?: KernelClient;
  initialState?: StoreState;
  initialPlan?: PlanStep[];
  theme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

export function Workspace({
  kernelClient,
  initialState,
  initialPlan,
  theme,
  onThemeChange
}: WorkspaceProps): JSX.Element {
  const client = kernelClient ?? resolveKernelClient();
  const [state, setState] = React.useState<StoreState>(initialState ?? initial());
  const [plan, setPlan] = React.useState<PlanStep[]>(initialPlan ?? []);
  const [localTheme, setLocalTheme] = React.useState<'light' | 'dark'>('light');
  const [error, setError] = React.useState<string>('');
  const [cost, setCost] = React.useState({ tokens: 0, usd: 0 });
  const activeTheme = theme ?? localTheme;

  React.useEffect(() => {
    const unsubscribe = client.onEvent((event) => {
      if (event.type === 'plan_ready') {
        setPlan(event.steps);
      }

      if (event.type === 'evidence_produced') {
        setCost((current) => ({
          tokens: current.tokens + 1,
          usd: current.usd + 0.001
        }));
      }

      setState((previous) => reduce(previous, event));
    });

    return unsubscribe;
  }, [client]);

  const handleSubmit = async (input: string): Promise<void> => {
    setError('');
    try {
      await client.startTask(input);
    } catch (err) {
      setError((err as Error).message ?? '任务提交失败');
    }
  };

  const handleDecision = async (decision: 'allow' | 'deny'): Promise<void> => {
    if (!state.pendingGate) {
      return;
    }

    try {
      await client.approveGate(state.pendingGate.gateId, decision);
      setState((previous) => ({ ...previous, pendingGate: undefined }));
    } catch (err) {
      setError((err as Error).message ?? '闸口确认失败');
    }
  };

  return (
    <section className="workspace-layout">
      <h2 className="screen-title">主工作区</h2>
      <p className="muted">小白也能从“发需求 → 看证据 → 掌控风险”完成任务。</p>

      <ChatStream messages={state.steps} onSubmit={handleSubmit} disabled={Boolean(state.pendingGate)} />

      <div className="workspace-grid">
        <PlanView steps={plan} />
        <EvidencePanel evidence={state.evidence as Evidence[]} />
      </div>

      {state.pendingGate && (
        <GateDialog reason={state.pendingGate.reason} onDecide={handleDecision} />
      )}

      <section className="workspace-footer">
        <CostBar tokens={cost.tokens} usd={cost.usd} />
        <ThemeToggle
          theme={activeTheme}
          onToggle={(nextTheme) => (onThemeChange ? onThemeChange(nextTheme) : setLocalTheme(nextTheme))}
        />
      </section>

      <div className="muted">任务状态：{state.status}</div>

      {error && <div className="error-box">错误：{error}</div>}
    </section>
  );
}
