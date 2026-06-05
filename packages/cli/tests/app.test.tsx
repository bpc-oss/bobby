import React from 'react';
import { expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import type { KernelEvent, PlanStep } from '@bobby/shared';

import { App } from '../src/ui/App';
import { initialVM } from '../src/ui/view-model';
import type { PermissionDecision } from '../src/ui/PermissionPrompt';
import type { SlashCommandInput } from '../src/ui/input-commands';

type InputSubmit = (value: string) => void;
type InputCommand = (command: SlashCommandInput) => void;
type InputAbort = () => void;
type PlanDecision = (decision: 'approve' | 'edit' | 'reject') => void;
type GateDecision = (decision: PermissionDecision) => void;
type HostStub = {
  subscribe: (fn: (event: KernelEvent) => void) => () => void;
};
let capturedSubmit: InputSubmit | null = null;
let capturedCommand: InputCommand | null = null;
let capturedAbort: InputAbort | null = null;
let capturedPlanDecision: PlanDecision | null = null;
let capturedGateDecision: GateDecision | null = null;

vi.mock('../src/ui/InputBox', () => ({
  InputBox: ({
    onSubmit,
    onCommand,
    onAbort
  }: {
    onSubmit: InputSubmit;
    onCommand?: InputCommand;
    onAbort?: InputAbort;
  }) => {
    capturedSubmit = onSubmit;
    capturedCommand = onCommand ?? null;
    capturedAbort = onAbort ?? null;
    return <Text>input</Text>;
  }
}));

vi.mock('../src/ui/PermissionPrompt', () => ({
  PermissionPrompt: ({
    reason,
    onDecision
  }: {
    reason: string;
    onDecision: GateDecision;
  }) => {
    capturedGateDecision = onDecision;
    return <Text>{`permission: ${reason}`}</Text>;
  }
}));

vi.mock('../src/ui/PlanView', () => ({
  PlanView: ({
    steps,
    onDecision
  }: {
    steps: PlanStep[];
    onDecision: PlanDecision;
  }) => {
    capturedPlanDecision = onDecision;
    return <Text>{`plan view: ${steps.length}`}</Text>;
  }
}));

const richHostEvents: KernelEvent[] = [
  {
    type: 'intent_proposed',
    taskId: 'task-1',
    contract: {
      goal: 'build cli',
      acceptanceCriteria: [],
      constraints: [],
      inputs: [],
      outOfScope: []
    }
  },
  { type: 'plan_ready', taskId: 'task-1', steps: [{ id: 'S1', desc: 'do work', satisfiesAcIds: [], dependsOn: [] }] },
  { type: 'step_started', taskId: 'task-1', stepId: 'S1' },
  { type: 'tool_called', taskId: 'task-1', stepId: 'S1', tool: 'exec node --version' },
  {
    type: 'evidence_produced',
    taskId: 'task-1',
    evidence: {
      claimId: 'C1',
      acId: 'AC1',
      evidenceType: 'command_output',
      payload: { exitCode: 1, stderr: 'boom' },
      producedBy: 'tool'
    }
  },
  { type: 'final_result', taskId: 'task-1', status: 'done' }
];

const createHost = (events: KernelEvent[]): HostStub => ({
  subscribe: (handleEvent) => {
    for (const event of events) {
      handleEvent(event);
    }
    return () => undefined;
  }
});

it('renders goal/plan/step/done lines from vm', () => {
  const { lastFrame } = render(
    <App
      initialVm={{
        ...initialVM(),
        lines: ['goal: build demo', 'plan: S1', 'step: S1', 'status: done'],
        items: [
          { kind: 'line', text: 'goal: build demo' },
          { kind: 'line', text: 'plan: S1' },
          { kind: 'line', text: 'step: S1' },
          { kind: 'line', text: 'status: done' }
        ],
        status: 'done',
        planSteps: ['S1'],
        activeSteps: ['S1']
      }}
      onSubmit={() => {}}
      onGate={() => {}}
    />
  );

  const frame = lastFrame();
  expect(frame).toContain('goal: build demo');
  expect(frame).toContain('plan:');
  expect(frame).toContain('step: S1');
  expect(frame).toContain('status: done');
});

it('calls onGate when pending gate is accepted', () => {
  capturedGateDecision = null;
  const onGate = vi.fn();
  render(
    <App
      initialVm={{
        ...initialVM(),
        pendingGate: { gateId: 'g1', reason: 'requires external permission' },
        planSteps: [],
        activeSteps: [],
      }}
      onSubmit={() => {}}
      onGate={onGate}
    />
  );

  if (!capturedGateDecision) {
    throw new Error('PermissionPrompt decision callback not captured');
  }
  (capturedGateDecision as GateDecision)('allow');
  expect(onGate).toHaveBeenCalledWith('g1', 'allow');
});

it('submits hello input as text command', () => {
  capturedSubmit = null;
  const onSubmit = vi.fn();
  render(
    <App
      initialVm={{
        ...initialVM(),
        lines: ['starting'],
        planSteps: [],
        activeSteps: []
      }}
      onSubmit={onSubmit}
      onGate={() => {}}
    />
  );

  if (!capturedSubmit) {
    throw new Error('InputBox submit callback not captured');
  }
  (capturedSubmit as InputSubmit)('hello');
  expect(onSubmit).toHaveBeenCalledWith('hello');
});

it('handles slash help without submitting a task', async () => {
  capturedCommand = null;
  const onSubmit = vi.fn();
  const { lastFrame } = render(
    <App
      initialVm={initialVM()}
      onSubmit={onSubmit}
      onGate={() => {}}
    />
  );

  if (!capturedCommand) {
    throw new Error('InputBox command callback not captured');
  }
  (capturedCommand as InputCommand)({ kind: 'slash', command: 'help', args: [], normalized: '/help' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(lastFrame()).toContain('/help /clear /status /cost /undo /agents /resume /exit');
});

it('sends abort for the current task when input aborts', () => {
  capturedAbort = null;
  const onAbort = vi.fn();
  render(
    <App
      initialVm={{ ...initialVM(), currentTaskId: 'task-1' }}
      onSubmit={() => {}}
      onGate={() => {}}
      onAbort={onAbort}
    />
  );

  if (!capturedAbort) {
    throw new Error('InputBox abort callback not captured');
  }
  (capturedAbort as InputAbort)();
  expect(onAbort).toHaveBeenCalledWith('task-1');
});

it('rejects the visible plan by aborting the current task', () => {
  capturedPlanDecision = null;
  const onAbort = vi.fn();
  render(
    <App
      initialVm={{
        ...initialVM(),
        status: 'running',
        currentTaskId: 'task-1',
        currentPlan: [{ id: 'S1', desc: 'do work', satisfiesAcIds: [], dependsOn: [] }]
      }}
      onSubmit={() => {}}
      onGate={() => {}}
      onAbort={onAbort}
    />
  );

  if (!capturedPlanDecision) {
    throw new Error('PlanView decision callback not captured');
  }
  (capturedPlanDecision as PlanDecision)('reject');
  expect(onAbort).toHaveBeenCalledWith('task-1');
});

it('renders rich lines after receiving host events', async () => {
  const { lastFrame } = render(
    <App
      host={createHost(richHostEvents)}
      initialVm={initialVM()}
      onSubmit={() => {}}
      onGate={() => {}}
    />
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  const frame = lastFrame();
  expect(frame).toContain('goal: build cli');
  expect(frame).toContain('plan: 1 steps (S1)');
  expect(frame).toContain('step: S1');
  expect(frame).toContain('* exec(node --version)');
  expect(frame).toContain('command_output(exitCode=1');
  expect(frame).toContain('status: done');
});
