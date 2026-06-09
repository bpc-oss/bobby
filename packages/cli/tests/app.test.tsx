import React from 'react';
import { expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import type { KernelEvent, PlanStep } from '@bobby/shared';

import { App } from '../src/ui/App';
import { initialVM } from '../src/ui/view-model';
import type { PermissionDecision } from '../src/ui/PermissionPrompt';
import type { SlashCommandInput, UnknownSlashCommandInput } from '../src/ui/input-commands';

type InputSubmit = (value: string) => void;
type InputCommand = (command: SlashCommandInput | UnknownSlashCommandInput) => void;
type InputAbort = () => void;
type PlanDecision = (decision: 'approve' | 'edit' | 'reject') => void;
type PlanCommand = (taskId: string, decision: 'approve' | 'reject' | 'edit', instructions?: string) => void;
type GateDecision = (decision: PermissionDecision) => void;
type HostStub = {
  subscribe: (fn: (event: KernelEvent) => void) => () => void;
};
let capturedSubmit: InputSubmit | null = null;
let capturedCommand: InputCommand | null = null;
let capturedAbort: InputAbort | null = null;
let capturedExit: InputAbort | null = null;
let capturedPlanDecision: PlanDecision | null = null;
let capturedPlanCommand: PlanCommand | null = null;
let capturedGateDecision: GateDecision | null = null;

vi.mock('../src/ui/InputBox', () => ({
  InputBox: ({
    onSubmit,
    onCommand,
    onAbort,
    onExit
  }: {
    onSubmit: InputSubmit;
    onCommand?: InputCommand;
    onAbort?: InputAbort;
    onExit?: InputAbort;
  }) => {
    capturedSubmit = onSubmit;
    capturedCommand = onCommand ?? null;
    capturedAbort = onAbort ?? null;
    capturedExit = onExit ?? null;
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

it('renders clean output lines from vm', () => {
  const { lastFrame } = render(
    <App
      initialVm={{
        ...initialVM(),
        lines: ['Hello, world', 'Done.'],
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
  expect(capturedGateDecision).toBeDefined();
});

it('calls onGate when pending gate is accepted as always', () => {
  capturedGateDecision = null;
  const onGate = vi.fn();
  render(
    <App
      initialVm={{
        ...initialVM(),
        pendingGate: { gateId: 'g2', reason: 'requires external permission' },
        planSteps: [],
        activeSteps: []
      }}
      onSubmit={() => {}}
      onGate={onGate}
    />
  );

  if (!capturedGateDecision) {
    throw new Error('PermissionPrompt decision callback not captured');
  }
  (capturedGateDecision as GateDecision)('always');
  expect(onGate).toHaveBeenCalledWith('g2', 'always');
  expect(capturedGateDecision).toBeDefined();
});

it('hides permission prompt after allow decision while still calling onGate', async () => {
  capturedGateDecision = null;
  const onGate = vi.fn();
  let emitEvent: (event: KernelEvent) => void = () => {};

  const app = render(
    <App
      host={{
        subscribe: (fn) => {
          emitEvent = fn;
          return () => undefined;
        }
      }}
      initialVm={initialVM()}
      onSubmit={() => {}}
      onGate={(gateId, decision) => {
        onGate(gateId, decision);
        emitEvent({ type: 'step_started', taskId: 'task-1', stepId: 'S1' });
      }}
    />
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  emitEvent({
    type: 'gate_request',
    taskId: 'task-1',
    gateId: 'g3',
    reason: 'requires external permission'
  });

  expect(app.lastFrame()).toContain('permission: requires external permission');

  if (!capturedGateDecision) {
    throw new Error('PermissionPrompt decision callback not captured');
  }

  (capturedGateDecision as GateDecision)('allow');

  expect(onGate).toHaveBeenCalledWith('g3', 'allow');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(app.lastFrame()).not.toContain('permission: requires external permission');
});

it('hides permission prompt after always decision while still calling onGate', async () => {
  capturedGateDecision = null;
  const onGate = vi.fn();
  let emitEvent: (event: KernelEvent) => void = () => {};

  const app = render(
    <App
      host={{
        subscribe: (fn) => {
          emitEvent = fn;
          return () => undefined;
        }
      }}
      initialVm={initialVM()}
      onSubmit={() => {}}
      onGate={(gateId, decision) => {
        onGate(gateId, decision);
        emitEvent({ type: 'final_result', taskId: 'task-1', status: 'done' });
      }}
    />
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  emitEvent({
    type: 'gate_request',
    taskId: 'task-1',
    gateId: 'g4',
    reason: 'requires external permission'
  });

  expect(app.lastFrame()).toContain('permission: requires external permission');

  if (!capturedGateDecision) {
    throw new Error('PermissionPrompt decision callback not captured');
  }

  (capturedGateDecision as GateDecision)('always');

  expect(onGate).toHaveBeenCalledWith('g4', 'always');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(app.lastFrame()).not.toContain('permission: requires external permission');
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
  expect(lastFrame()).toContain('/help /clear /status /probe /cost /undo /agents /resume /exit');
});

it('handles /probe in Ink App by submitting /probe instead of slash handler', async () => {
  capturedCommand = null;
  const onSubmit = vi.fn();
  const onSlashCommand = vi.fn();
  const { lastFrame } = render(
    <App initialVm={initialVM()} onSubmit={onSubmit} onGate={() => {}} onSlashCommand={onSlashCommand} />
  );

  if (!capturedCommand) {
    throw new Error('InputBox command callback not captured');
  }
  (capturedCommand as InputCommand)({ kind: 'slash', command: 'probe', args: [], normalized: '/probe' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(onSubmit).toHaveBeenCalledWith('/probe');
  expect(onSlashCommand).not.toHaveBeenCalled();
  expect(lastFrame()).not.toContain('unknown command: /probe');
});

const invalidArgSlashCommands: Array<
  {
    command: Exclude<SlashCommandInput['command'], 'undo'>;
    args: string[];
    normalized: string;
  }
> = [
  { command: 'status', args: ['now'], normalized: '/status now' },
  { command: 'probe', args: ['now'], normalized: '/probe now' },
  { command: 'exit', args: ['now'], normalized: '/exit now' },
  { command: 'help', args: ['details'], normalized: '/help details' },
  { command: 'clear', args: ['now'], normalized: '/clear now' },
  { command: 'cost', args: ['now'], normalized: '/cost now' },
  { command: 'agents', args: ['now'], normalized: '/agents now' },
  { command: 'resume', args: ['now'], normalized: '/resume now' }
];

it.each(invalidArgSlashCommands)(
  'renders unknown command help when $normalized contains unsupported args',
  async ({ command, args, normalized }) => {
    capturedCommand = null;
    const onSubmit = vi.fn();
    const onSlashCommand = vi.fn();
    const { lastFrame } = render(
      <App initialVm={initialVM()} onSubmit={onSubmit} onGate={() => {}} onSlashCommand={onSlashCommand} />
    );

    if (!capturedCommand) {
      throw new Error('InputBox command callback not captured');
    }
    (capturedCommand as InputCommand)({ kind: 'slash', command, args, normalized });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onSlashCommand).not.toHaveBeenCalled();
    const frame = lastFrame();
    expect(frame).toContain(`unknown command: ${normalized}`);
    expect(frame).toContain('/help /clear /status /probe /cost /undo /agents /resume /exit');
  }
);

it('handles /cost with usage data', async () => {
  capturedCommand = null;
  const onSubmit = vi.fn();
  const { lastFrame } = render(
    <App
      initialVm={{
        ...initialVM(),
        spentUsd: 3.14159,
        proCalls: 2,
        flashCalls: 1,
        contextPercent: 42.5
      }}
      onSubmit={onSubmit}
      onGate={() => {}}
    />
  );

  if (!capturedCommand) {
    throw new Error('InputBox command callback not captured');
  }
  (capturedCommand as InputCommand)({ kind: 'slash', command: 'cost', args: [], normalized: '/cost' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(onSubmit).not.toHaveBeenCalled();
  const frame = lastFrame();
  expect(frame).toContain('cost: spent $3.14 | 2 pro calls | 1 flash calls | 42.50% context');
});

it('handles /cost with no usage data', async () => {
  capturedCommand = null;
  const onSubmit = vi.fn();
  const { lastFrame } = render(
    <App initialVm={initialVM()} onSubmit={onSubmit} onGate={() => {}} />
  );

  if (!capturedCommand) {
    throw new Error('InputBox command callback not captured');
  }
  (capturedCommand as InputCommand)({ kind: 'slash', command: 'cost', args: [], normalized: '/cost' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(lastFrame()).toContain('cost: no usage data yet');
});

it('clears visible transcript entries but keeps input and status line', async () => {
  capturedCommand = null;
  const { lastFrame } = render(
    <App
      initialVm={{
        ...initialVM(),
        lines: ['Hello, world', 'Done.'],
        items: [
          { kind: 'line', text: 'goal: build demo' },
          { kind: 'line', text: 'plan: 1 steps (S1)' },
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

  if (!capturedCommand) {
    throw new Error('InputBox command callback not captured');
  }

  (capturedCommand as InputCommand)({ kind: 'slash', command: 'clear', args: [], normalized: '/clear' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const frame = lastFrame();
  expect(frame).not.toContain('goal: build demo');
  expect(frame).not.toContain('plan: 1 steps (S1)');
  expect(frame).not.toContain('step: S1');
  expect(frame).toContain('✓ done');
  expect(frame).toContain('input');
});

it('shows new direct_answer and step_started events after clear', async () => {
  capturedCommand = null;
  let emitEvent: (event: KernelEvent) => void = () => {};
  const app = render(
    <App
      host={{
        subscribe: (fn) => {
          emitEvent = fn;
          return () => undefined;
        }
      }}
      initialVm={{
        ...initialVM(),
        currentTaskId: 'task-1',
        lines: ['Hello, world', 'Done.'],
        items: [
          { kind: 'line', text: 'goal: build demo' },
          { kind: 'line', text: 'plan: 1 steps (S1)' },
          { kind: 'line', text: 'step: S1' }
        ],
        planSteps: ['S1'],
        activeSteps: ['S1'],
        status: 'running'
      }}
      onSubmit={() => {}}
      onGate={() => {}}
    />
  );

  if (!capturedCommand) {
    throw new Error('InputBox command callback not captured');
  }

  (capturedCommand as InputCommand)({ kind: 'slash', command: 'clear', args: [], normalized: '/clear' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  emitEvent({ type: 'direct_answer', taskId: 'task-1', text: 'fresh answer' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  emitEvent({ type: 'step_started', taskId: 'task-1', stepId: 'S2' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const frame = app.lastFrame();
  expect(frame).not.toContain('goal: build demo');
  expect(frame).not.toContain('step: S1');
  expect(frame).toContain('fresh answer');
});

it('forwards /undo slash command to host slash handler', async () => {
  capturedCommand = null;
  const onSubmit = vi.fn();
  const onSlashCommand = vi.fn();
  const { lastFrame } = render(
    <App initialVm={initialVM()} onSubmit={onSubmit} onGate={() => {}} onSlashCommand={onSlashCommand} />
  );

  if (!capturedCommand) {
    throw new Error('InputBox command callback not captured');
  }
  (capturedCommand as InputCommand)({ kind: 'slash', command: 'undo', args: ['snapshot-1'], normalized: '/undo snapshot-1' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(onSlashCommand).toHaveBeenCalledWith({
    kind: 'slash',
    command: 'undo',
    args: ['snapshot-1'],
    normalized: '/undo snapshot-1'
  });
  expect(lastFrame()).not.toContain('undo: no checkpoints available');
});

it('forwards /agents slash command to host slash handler', async () => {
  capturedCommand = null;
  const onSubmit = vi.fn();
  const onSlashCommand = vi.fn();
  const { lastFrame } = render(
    <App initialVm={initialVM()} onSubmit={onSubmit} onGate={() => {}} onSlashCommand={onSlashCommand} />
  );

  if (!capturedCommand) {
    throw new Error('InputBox command callback not captured');
  }
  (capturedCommand as InputCommand)({ kind: 'slash', command: 'agents', args: [], normalized: '/agents' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(onSlashCommand).toHaveBeenCalledWith({
    kind: 'slash',
    command: 'agents',
    args: [],
    normalized: '/agents'
  });
  expect(lastFrame()).not.toContain('agent');
});

it('forwards /resume slash command to host slash handler', async () => {
  capturedCommand = null;
  const onSubmit = vi.fn();
  const onSlashCommand = vi.fn();
  const { lastFrame } = render(
    <App initialVm={initialVM()} onSubmit={onSubmit} onGate={() => {}} onSlashCommand={onSlashCommand} />
  );

  if (!capturedCommand) {
    throw new Error('InputBox command callback not captured');
  }
  (capturedCommand as InputCommand)({ kind: 'slash', command: 'resume', args: [], normalized: '/resume' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(onSlashCommand).toHaveBeenCalledWith({
    kind: 'slash',
    command: 'resume',
    args: [],
    normalized: '/resume'
  });
  expect(lastFrame()).not.toContain('resumable');
});

it('renders local help for unknown slash command and avoids host submit', async () => {
  capturedCommand = null;
  const onSubmit = vi.fn();
  const onSlashCommand = vi.fn();
  const { lastFrame } = render(
    <App initialVm={initialVM()} onSubmit={onSubmit} onGate={() => {}} onSlashCommand={onSlashCommand} />
  );

  if (!capturedCommand) {
    throw new Error('InputBox command callback not captured');
  }
  (capturedCommand as InputCommand)({
    kind: 'unknown_slash',
    command: 'not-real',
    args: ['args'],
    normalized: '/not-real args'
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(onSlashCommand).not.toHaveBeenCalled();
  const frame = lastFrame();
  expect(frame).toContain('unknown command: /not-real args');
  expect(frame).toContain('commands: /help /clear /status /probe /cost /undo /agents /resume /exit');
});

it('uses local fallback for /agents when slash handler is missing', async () => {
  capturedCommand = null;
  const onSubmit = vi.fn();
  const { lastFrame } = render(
    <App initialVm={initialVM()} onSubmit={onSubmit} onGate={() => {}} />
  );

  if (!capturedCommand) {
    throw new Error('InputBox command callback not captured');
  }
  (capturedCommand as InputCommand)({ kind: 'slash', command: 'agents', args: [], normalized: '/agents' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(lastFrame()).toContain('agents: no agents');
  expect(lastFrame()).not.toContain('command handler unavailable in this UI session');
  expect(lastFrame()).not.toContain('not wired yet');
});

it('uses local fallback for /undo when slash handler is missing', async () => {
  capturedCommand = null;
  const onSubmit = vi.fn();
  const { lastFrame } = render(
    <App initialVm={initialVM()} onSubmit={onSubmit} onGate={() => {}} />
  );

  if (!capturedCommand) {
    throw new Error('InputBox command callback not captured');
  }
  (capturedCommand as InputCommand)({ kind: 'slash', command: 'undo', args: ['snapshot-1'], normalized: '/undo snapshot-1' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(lastFrame()).toContain('undo: no snapshots available');
  expect(lastFrame()).not.toContain('command handler unavailable in this UI session');
  expect(lastFrame()).not.toContain('not wired yet');
});

it('uses local fallback for /resume when slash handler is missing', async () => {
  capturedCommand = null;
  const onSubmit = vi.fn();
  const { lastFrame } = render(
    <App initialVm={initialVM()} onSubmit={onSubmit} onGate={() => {}} />
  );

  if (!capturedCommand) {
    throw new Error('InputBox command callback not captured');
  }
  (capturedCommand as InputCommand)({ kind: 'slash', command: 'resume', args: [], normalized: '/resume' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(lastFrame()).toContain('resume: no resumable trace in current process');
  expect(lastFrame()).not.toContain('command handler unavailable in this UI session');
  expect(lastFrame()).not.toContain('not wired yet');
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

it('routes exit callback to /exit submission', () => {
  capturedExit = null;
  const onSubmit = vi.fn();
  render(<App initialVm={initialVM()} onSubmit={onSubmit} onGate={() => {}} />);

  if (!capturedExit) {
    throw new Error('InputBox exit callback not captured');
  }

  (capturedExit as InputAbort)();
  expect(onSubmit).toHaveBeenCalledWith('/exit');
});

it('maps plan reject to onPlanDecision command', () => {
  capturedPlanDecision = null;
  capturedPlanCommand = null;
  const onPlanDecision = vi.fn();
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
      onPlanDecision={onPlanDecision}
    />
  );

  if (!capturedPlanDecision) {
    throw new Error('PlanView decision callback not captured');
  }
  (capturedPlanDecision as PlanDecision)('reject');
  expect(onPlanDecision).toHaveBeenCalledWith('task-1', 'reject');

  capturedPlanCommand = onPlanDecision;
  expect(capturedPlanCommand).toEqual(onPlanDecision);
});

it('maps plan approve to onPlanDecision command', () => {
  capturedPlanDecision = null;
  const onPlanDecision = vi.fn();
  render(
    <App
      initialVm={{
        ...initialVM(),
        status: 'running',
        currentTaskId: 'task-2',
        currentPlan: [{ id: 'S1', desc: 'do work', satisfiesAcIds: [], dependsOn: [] }]
      }}
      onSubmit={() => {}}
      onGate={() => {}}
      onPlanDecision={onPlanDecision}
    />
  );

  if (!capturedPlanDecision) {
    throw new Error('PlanView decision callback not captured');
  }
  (capturedPlanDecision as PlanDecision)('approve');
  expect(onPlanDecision).toHaveBeenCalledWith('task-2', 'approve');
});

it('dismisses plan view after approve decision while still sending onPlanDecision', async () => {
  capturedPlanDecision = null;
  const onPlanDecision = vi.fn();
  const app = render(
    <App
      initialVm={{
        ...initialVM(),
        status: 'running',
        currentTaskId: 'task-5',
        currentPlan: [{ id: 'S1', desc: 'do work', satisfiesAcIds: [], dependsOn: [] }]
      }}
      onSubmit={() => {}}
      onGate={() => {}}
      onPlanDecision={onPlanDecision}
    />
  );

  expect(app.lastFrame()).toContain('plan view: 1');

  if (!capturedPlanDecision) {
    throw new Error('PlanView decision callback not captured');
  }

  (capturedPlanDecision as PlanDecision)('approve');
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(app.lastFrame()).not.toContain('plan view: 1');
  expect(onPlanDecision).toHaveBeenCalledWith('task-5', 'approve');
});

it('dismisses plan view after edit decision and sends non-empty edit input', async () => {
  capturedPlanDecision = null;
  capturedSubmit = null;
  const onPlanDecision = vi.fn();

  const app = render(
    <App
      initialVm={{
        ...initialVM(),
        status: 'running',
        currentTaskId: 'task-6',
        currentPlan: [{ id: 'S1', desc: 'do work', satisfiesAcIds: [], dependsOn: [] }]
      }}
      onSubmit={() => {}}
      onGate={() => {}}
      onPlanDecision={onPlanDecision}
    />
  );

  expect(app.lastFrame()).toContain('plan view: 1');

  if (!capturedPlanDecision) {
    throw new Error('PlanView decision callback not captured');
  }
  if (!capturedSubmit) {
    throw new Error('InputBox submit callback not captured');
  }

  (capturedPlanDecision as PlanDecision)('edit');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(app.lastFrame()).not.toContain('plan view: 1');

  (capturedSubmit as InputSubmit)('split it into two phases');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(onPlanDecision).toHaveBeenCalledWith('task-6', 'edit', 'split it into two phases');
});

it('shows a revised plan after the dismissed task returns updated plan details', async () => {
  capturedPlanDecision = null;
  let emitEvent: (event: KernelEvent) => void = () => {};
  const app = render(
    <App
      host={{
        subscribe: (fn) => {
          emitEvent = fn;
          return () => undefined;
        }
      }}
      initialVm={{
        ...initialVM(),
        status: 'running',
        currentTaskId: 'task-7',
        currentPlan: [{ id: 'S1', desc: 'draft plan', satisfiesAcIds: [], dependsOn: [] }]
      }}
      onSubmit={() => {}}
      onGate={() => {}}
      onPlanDecision={() => {}}
    />
  );

  expect(app.lastFrame()).toContain('plan view: 1');

  if (!capturedPlanDecision) {
    throw new Error('PlanView decision callback not captured');
  }

  (capturedPlanDecision as PlanDecision)('approve');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(app.lastFrame()).not.toContain('plan view: 1');

  emitEvent({
    type: 'plan_ready',
    taskId: 'task-7',
    steps: [{ id: 'S1', desc: 'revised plan', satisfiesAcIds: [], dependsOn: [] }]
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(app.lastFrame()).toContain('plan view: 1');
});

it('enters plan edit mode and sends next non-empty input as edit instructions', () => {
  capturedPlanDecision = null;
  const onPlanDecision = vi.fn();
  const onSubmit = vi.fn();

  render(
    <App
      initialVm={{
        ...initialVM(),
        status: 'running',
        currentTaskId: 'task-3',
        currentPlan: [{ id: 'S1', desc: 'do work', satisfiesAcIds: [], dependsOn: [] }]
      }}
      onSubmit={onSubmit}
      onGate={() => {}}
      onPlanDecision={onPlanDecision}
    />
  );

  if (!capturedPlanDecision) {
    throw new Error('PlanView decision callback not captured');
  }
  if (!capturedSubmit) {
    throw new Error('InputBox submit callback not captured');
  }

  (capturedPlanDecision as PlanDecision)('edit');
  (capturedSubmit as InputSubmit)('split it into two phases');

  expect(onPlanDecision).toHaveBeenCalledWith('task-3', 'edit', 'split it into two phases');
  expect(onSubmit).not.toHaveBeenCalled();
});

it('does not send blank edit instructions as planDecision', () => {
  capturedPlanDecision = null;
  const onPlanDecision = vi.fn();
  const onSubmit = vi.fn();

  render(
    <App
      initialVm={{
        ...initialVM(),
        status: 'running',
        currentTaskId: 'task-4',
        currentPlan: [{ id: 'S1', desc: 'do work', satisfiesAcIds: [], dependsOn: [] }]
      }}
      onSubmit={onSubmit}
      onGate={() => {}}
      onPlanDecision={onPlanDecision}
    />
  );

  if (!capturedPlanDecision) {
    throw new Error('PlanView decision callback not captured');
  }
  if (!capturedSubmit) {
    throw new Error('InputBox submit callback not captured');
  }

  (capturedPlanDecision as PlanDecision)('edit');
  (capturedSubmit as InputSubmit)('   ');

  expect(onPlanDecision).not.toHaveBeenCalled();
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
  expect(frame).toContain('* exec(node --version)');
  expect(frame).toContain('command_output(exitCode=1');
  expect(frame).toContain('Done.');
});
