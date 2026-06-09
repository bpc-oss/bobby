import React from 'react';

import { initial, reduce } from '../store/app-store';
import type { AppState as StoreState } from '../store/app-store';
import type { Evidence, GateDecision, KernelEvent, PlanStep } from '@bobby/shared';
import { ChatStream } from '../components/ChatStream';
import { CostBar } from '../components/CostBar';
import { EvidencePanel } from '../components/EvidencePanel';
import { GateDialog } from '../components/GateDialog';
import { makeKernelClient } from '../ipc/contract';
import { PlanView } from '../components/PlanView';
import { ThemeToggle } from '../components/ThemeToggle';

type KernelClient = {
  startTask: (input: string) => Promise<unknown>;
  approveGate: (gateId: string, decision: GateDecision) => Promise<unknown>;
  onEvent: (callback: (event: KernelEvent) => void) => () => void;
};

type WorkspaceTheme = 'light' | 'dark';

const fallbackClient: KernelClient = {
  startTask: async () => undefined,
  approveGate: async () => undefined,
  onEvent: () => () => undefined
};

interface WorkspaceProps {
  kernelClient?: KernelClient;
  initialState?: StoreState;
  initialPlan?: PlanStep[];
  theme?: WorkspaceTheme;
  onThemeChange?: (theme: WorkspaceTheme) => void;
}

function resolveKernelClient(): KernelClient {
  if (typeof window === 'undefined') {
    return fallbackClient;
  }

  if (((window as unknown as { bobby?: unknown }).bobby) !== undefined) {
    return makeKernelClient();
  }

  return fallbackClient;
}

function applyKernelEvent(
  event: KernelEvent,
  setPlan: React.Dispatch<React.SetStateAction<PlanStep[]>>,
  setCost: React.Dispatch<React.SetStateAction<{ tokens: number; usd: number }>>,
  setState: React.Dispatch<React.SetStateAction<StoreState>>
): void {
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
}

function buildSubmitHandler(
  client: KernelClient,
  setError: React.Dispatch<React.SetStateAction<string>>
): (input: string) => Promise<void> {
  return async (input: string): Promise<void> => {
    setError('');
    try {
      await client.startTask(input);
    } catch (err) {
      setError((err as Error).message ?? '任务提交失败');
    }
  };
}

function buildDecisionHandler(
  client: KernelClient,
  state: StoreState,
  setState: React.Dispatch<React.SetStateAction<StoreState>>,
  setError: React.Dispatch<React.SetStateAction<string>>
): (decision: GateDecision) => Promise<void> {
  return async (decision: GateDecision): Promise<void> => {
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
}

function WorkspaceError({ error }: { error: string }): JSX.Element | null {
  if (!error) {
    return null;
  }

  return <div className="error-box">错误：{error}</div>;
}

function WorkspaceBody({
  state,
  plan,
  activeTheme,
  onToggleTheme,
  onSubmit,
  onDecision,
  cost,
  error
}: {
  state: StoreState;
  plan: PlanStep[];
  activeTheme: WorkspaceTheme;
  onToggleTheme: (nextTheme: WorkspaceTheme) => void;
  onSubmit: (input: string) => Promise<void>;
  onDecision: (decision: GateDecision) => Promise<void>;
  cost: { tokens: number; usd: number };
  error: string;
}): JSX.Element {
  return (
    <section className="workspace-layout">
      <h2 className="screen-title">主工作区</h2>
      <p className="muted">小白也能从“发需求 → 看证据 → 掌控风险”完成任务。</p>

      <ChatStream messages={state.steps} onSubmit={onSubmit} disabled={Boolean(state.pendingGate)} />

      <div className="workspace-grid">
        <PlanView steps={plan} />
        <EvidencePanel evidence={state.evidence as Evidence[]} />
      </div>

      {state.pendingGate && <GateDialog reason={state.pendingGate.reason} onDecide={onDecision} />}

      <section className="workspace-footer">
        <CostBar tokens={cost.tokens} usd={cost.usd} />
        <ThemeToggle
          theme={activeTheme}
          onToggle={onToggleTheme}
        />
      </section>

      <div className="muted">任务状态：{state.status}</div>
      <WorkspaceError error={error} />
    </section>
  );
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
  const [localTheme, setLocalTheme] = React.useState<WorkspaceTheme>('light');
  const [error, setError] = React.useState<string>('');
  const [cost, setCost] = React.useState({ tokens: 0, usd: 0 });
  const activeTheme = theme ?? localTheme;
  const handleSubmit = React.useCallback(buildSubmitHandler(client, setError), [client]);

  React.useEffect(() => {
    const onEvent = (event: KernelEvent) => {
      applyKernelEvent(event, setPlan, setCost, setState);
    };

    return client.onEvent(onEvent);
  }, [client]);

  const handleDecision = React.useCallback(
    buildDecisionHandler(client, state, setState, setError),
    [client, state]
  );

  const handleThemeToggle = (nextTheme: WorkspaceTheme) => {
    if (onThemeChange) {
      onThemeChange(nextTheme);
      return;
    }
    setLocalTheme(nextTheme);
  };

  return (
    <WorkspaceBody
      state={state}
      plan={plan}
      activeTheme={activeTheme}
      onToggleTheme={handleThemeToggle}
      onSubmit={handleSubmit}
      onDecision={handleDecision}
      cost={cost}
      error={error}
    />
  );
}
