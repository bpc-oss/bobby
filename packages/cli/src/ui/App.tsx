import { Box } from 'ink';
import React, { useEffect, useState } from 'react';
import type { KernelEvent } from '@bobby/shared';
import type { VM, StreamItem } from './view-model';
import { initialVM, reduceEvent } from './view-model';
import { InputBox } from './InputBox';
import { MessageStream } from './MessageStream';
import { StatusLine } from './StatusLine';
import { PermissionPrompt, type PermissionDecision } from './PermissionPrompt';
import { PlanView } from './PlanView';
import type { SlashCommandInput, UnknownSlashCommandInput } from './input-commands';

type AppProps = {
  host?: {
    subscribe: (fn: (event: KernelEvent) => void) => () => void;
  };
  initialVm?: VM;
  onSubmit: (s: string) => void | Promise<void>;
  onGate: (gateId: string, decision: PermissionDecision) => void | Promise<void>;
  onSlashCommand?: (input: SlashCommandInput) => void | Promise<void>;
  onPlanDecision?: (taskId: string, decision: 'approve' | 'reject' | 'edit', instructions?: string) => void | Promise<void>;
  onAbort?: (taskId: string) => void | Promise<void>;
};

type HostFallbackSlashCommand = 'undo' | 'agents' | 'resume';
type ForwardHostSlashCommandInput = Omit<SlashCommandInput, 'command'> & { command: HostFallbackSlashCommand };
type LocalLineWriter = (line: string) => void;
type PlanDecision = 'approve' | 'edit' | 'reject';
type AppFrameProps = {
  vm: VM;
  visibleItems: StreamItem[];
  visibleLines: string[];
  showPlanView: boolean;
  onPlanDecision: (decision: PlanDecision) => void;
  onSubmit: (value: string) => void;
  onAbort: () => void;
  onExit: () => void;
  onSlashCommand: (input: SlashCommandInput | UnknownSlashCommandInput) => void;
  onPermissionDecision: (decision: PermissionDecision) => void;
  showPermissionPrompt: boolean;
};

function useViewModel(host: AppProps['host'], initial: VM | undefined): VM {
  const [vm, setVm] = useState<VM>(initial ?? initialVM());

  useEffect(() => {
    if (!host) {
      return;
    }

    const unsubscribe = host.subscribe((event) => {
      setVm((previous) => reduceEvent(previous, event));
    });

    return unsubscribe;
  }, [host]);

  return vm;
}

function useDismissedPendingGate(pendingGate: VM['pendingGate']): [string | null, (gateId: string) => void] {
  const [dismissedPendingGateId, setDismissedPendingGateId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingGate || pendingGate.gateId !== dismissedPendingGateId) {
      setDismissedPendingGateId(null);
    }
  }, [pendingGate?.gateId]);

  return [dismissedPendingGateId, setDismissedPendingGateId];
}

type PlanIdentity = string;

const getPlanIdentity = (vm: VM): PlanIdentity | null => {
  if (!vm.currentTaskId) {
    return null;
  }

  return JSON.stringify({
    taskId: vm.currentTaskId,
    steps: vm.currentPlan.map((step) => ({
      id: step.id,
      desc: step.desc,
      dependsOn: step.dependsOn,
      satisfiesAcIds: step.satisfiesAcIds
    }))
  });
};

function useDismissedPlan(currentPlanIdentity: PlanIdentity | null): [PlanIdentity | null, (identity: PlanIdentity) => void] {
  const [dismissedPlanIdentity, setDismissedPlanIdentity] = useState<PlanIdentity | null>(null);

  useEffect(() => {
    if (dismissedPlanIdentity !== currentPlanIdentity) {
      setDismissedPlanIdentity(null);
    }
  }, [currentPlanIdentity, dismissedPlanIdentity]);

  return [dismissedPlanIdentity, setDismissedPlanIdentity];
}

function usePlanVisibility(vm: VM): [boolean, (identity: PlanIdentity) => void] {
  const currentPlanIdentity = getPlanIdentity(vm);
  const [dismissedPlanIdentity, setDismissedPlanIdentity] = useDismissedPlan(currentPlanIdentity);
  const showPlanView =
    vm.currentPlan.length > 0 && vm.status === 'running' && currentPlanIdentity !== dismissedPlanIdentity;
  return [showPlanView, setDismissedPlanIdentity];
}

const slashHelpLine = (): string =>
  'commands: /help /clear /status /probe /cost /undo /agents /resume /exit';

const localLine = (text: string): StreamItem => ({ kind: 'line', text });

const hasAnyUsageData = (vm: VM): boolean => {
  return (
    typeof vm.costUsd === 'number' ||
    typeof vm.promptTokens === 'number' ||
    typeof vm.completionTokens === 'number' ||
    typeof vm.cachedTokens === 'number' ||
    typeof vm.usageModel === 'string' ||
    typeof vm.spentUsd === 'number' ||
    typeof vm.proCalls === 'number' ||
    typeof vm.flashCalls === 'number' ||
    typeof vm.contextPercent === 'number'
  );
};

const collectCostParts = (vm: VM): string[] => {
  const parts: string[] = [];
  if (typeof vm.spentUsd === 'number') {
    parts.push(`spent $${vm.spentUsd.toFixed(2)}`);
  }
  if (typeof vm.proCalls === 'number') {
    parts.push(`${vm.proCalls} pro calls`);
  }
  if (typeof vm.flashCalls === 'number') {
    parts.push(`${vm.flashCalls} flash calls`);
  }
  if (typeof vm.promptTokens === 'number') {
    parts.push(`prompt=${vm.promptTokens}`);
  }
  if (typeof vm.completionTokens === 'number') {
    parts.push(`completion=${vm.completionTokens}`);
  }
  if (typeof vm.cachedTokens === 'number') {
    parts.push(`cached=${vm.cachedTokens}`);
  }
  if (typeof vm.costUsd === 'number') {
    parts.push(`usage=$${vm.costUsd.toFixed(4)}`);
  }
  if (typeof vm.usageModel === 'string') {
    parts.push(`model=${vm.usageModel}`);
  }
  if (typeof vm.contextPercent === 'number') {
    parts.push(`${vm.contextPercent.toFixed(2)}% context`);
  }
  return parts;
};

const formatCostLine = (vm: VM): string => {
  if (!hasAnyUsageData(vm)) {
    return 'cost: no usage data yet';
  }

  return `cost: ${collectCostParts(vm).join(' | ')}`;
};

const createLineWriter = (
  setLocalLines: React.Dispatch<React.SetStateAction<string[]>>
): LocalLineWriter => {
  return (line: string): void => {
    setLocalLines((previous) => [...previous, line]);
  };
};

const createAbortHandler = (
  vm: VM,
  appendLocalLine: LocalLineWriter,
  onAbort?: AppProps['onAbort']
): (() => void) => () => {
  if (!vm.currentTaskId) {
    appendLocalLine('abort: no active task');
    return;
  }

  void onAbort?.(vm.currentTaskId);
};

const isForwardHostSlashCommandInput = (input: SlashCommandInput): input is ForwardHostSlashCommandInput =>
  input.command === 'undo' || input.command === 'agents' || input.command === 'resume';

const forwardHostSlashCommand = (
  input: SlashCommandInput,
  appendLocalLine: LocalLineWriter,
  onSlashCommand?: AppProps['onSlashCommand']
): void => {
  if (!onSlashCommand) {
    const fallbackLines: Record<HostFallbackSlashCommand, string> = {
      undo: 'undo: no snapshots available',
      agents: 'agents: no agents',
      resume: 'resume: no resumable trace in current process'
    };

    if (!isForwardHostSlashCommandInput(input)) {
      return;
    }

    appendLocalLine(fallbackLines[input.command]);
    return;
  }

  void onSlashCommand(input);
};

const assertNever = (value: never): never => {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
};

const createSlashHandler = (
  vm: VM,
  appendLocalLine: LocalLineWriter,
  setLocalLines: React.Dispatch<React.SetStateAction<string[]>>,
  setVisibleCursors: (vm: VM) => void,
  onSubmit: AppProps['onSubmit'],
  onSlashCommand?: AppProps['onSlashCommand']
): ((input: SlashCommandInput | UnknownSlashCommandInput) => void) => {
  return (input) => {
    if (input.kind === 'unknown_slash') {
      appendLocalLine(`unknown command: ${input.normalized}`);
      appendLocalLine(slashHelpLine());
      return;
    }
    if (input.command !== 'undo' && input.args.length > 0) {
      appendLocalLine(`unknown command: ${input.normalized}`);
      appendLocalLine(slashHelpLine());
      return;
    }
    switch (input.command) {
      case 'exit':
        void onSubmit('/exit');
        return;
      case 'clear':
        setLocalLines([]);
        setVisibleCursors(vm);
        return;
      case 'help':
        appendLocalLine(slashHelpLine());
        return;
      case 'status':
        appendLocalLine(`status: ${vm.status}`);
        return;
      case 'cost':
        appendLocalLine(formatCostLine(vm));
        return;
      case 'probe':
        void onSubmit('/probe');
        return;
      case 'undo':
      case 'agents':
      case 'resume':
        forwardHostSlashCommand(input, appendLocalLine, onSlashCommand);
        return;
      default: {
        return assertNever(input);
      }
    }
  };
};

const createPlanDecisionHandler = (
  appendLocalLine: LocalLineWriter,
  vm: VM,
  setPendingPlanEditTaskId: React.Dispatch<React.SetStateAction<string | null>>,
  setDismissedPlanIdentity: (identity: PlanIdentity) => void,
  onPlanDecision: AppProps['onPlanDecision']
): ((decision: PlanDecision) => void) => {
  const planIdentity = getPlanIdentity(vm);

  return (decision) => {
    appendLocalLine('');
    if (decision === 'approve' || decision === 'reject') {
      if (!vm.currentTaskId) {
        appendLocalLine('');
        return;
      }

      void onPlanDecision?.(vm.currentTaskId, decision);
      if (planIdentity) {
        setDismissedPlanIdentity(planIdentity);
      }
      setPendingPlanEditTaskId(null);
      return;
    }

    if (!vm.currentTaskId) {
      appendLocalLine('');
      return;
    }

    if (planIdentity) {
      setDismissedPlanIdentity(planIdentity);
    }

    setPendingPlanEditTaskId(vm.currentTaskId);
    appendLocalLine('');
  };
};

const createSubmitHandler = (
  onSubmit: AppProps['onSubmit'],
  onPlanDecision: AppProps['onPlanDecision'],
  pendingPlanEditTaskId: string | null,
  setPendingPlanEditTaskId: React.Dispatch<React.SetStateAction<string | null>>,
  appendLine: LocalLineWriter
): ((value: string) => void) => {
  return (value: string): void => {
    const line = value.trim();
    if (!line) {
      return;
    }

    if (!pendingPlanEditTaskId) {
      void onSubmit(line);
      return;
    }

    void onPlanDecision?.(pendingPlanEditTaskId, 'edit', line);
    setPendingPlanEditTaskId(null);
    appendLine('');
  };
};

const createExitHandler = (onSubmit: AppProps['onSubmit']): (() => void) => {
  return () => {
    void onSubmit('/exit');
  };
};

const createPermissionDecisionHandler = (
  vm: VM,
  onGate: AppProps['onGate'],
  dismissGate: (gateId: string) => void
): ((decision: PermissionDecision) => void) => {
  return (decision) => {
    if (!vm.pendingGate) {
      return;
    }

    const gateId = vm.pendingGate.gateId;
    dismissGate(gateId);
    void onGate(gateId, decision);
  };
};

const getVisibleContent = (
  vm: VM,
  localLines: string[],
  clearLineCount: number,
  clearItemCount: number
): { visibleItems: StreamItem[]; visibleLines: string[] } => {
  const lineCursor = Math.max(0, Math.min(clearLineCount, vm.lines.length));
  const itemCursor = Math.max(0, Math.min(clearItemCount, vm.items.length));
  return {
    visibleItems: [...vm.items.slice(itemCursor), ...localLines.map(localLine)],
    visibleLines: [...vm.lines.slice(lineCursor), ...localLines]
  };
};

function AppFrame({
  vm,
  visibleItems,
  visibleLines,
  showPlanView,
  onPlanDecision,
  onSubmit,
  onAbort,
  onExit,
  onSlashCommand,
  onPermissionDecision,
  showPermissionPrompt
}: AppFrameProps): JSX.Element {
  return (
    <Box flexDirection="column">
      <MessageStream lines={visibleLines} items={visibleItems} />
      {showPlanView ? (
        <PlanView steps={vm.currentPlan} onDecision={onPlanDecision} />
      ) : null}
      <StatusLine vm={vm} />
      <InputBox onSubmit={onSubmit} onAbort={onAbort} onExit={onExit} onCommand={onSlashCommand} />
      {showPermissionPrompt ? (
        <PermissionPrompt
          reason={vm.pendingGate!.reason}
          onDecision={onPermissionDecision}
        />
      ) : null}
    </Box>
  );
}

const createFrameCursors = (
  setClearedLineCount: React.Dispatch<React.SetStateAction<number>>,
  setClearedItemCount: React.Dispatch<React.SetStateAction<number>>
): ((nextVm: VM) => void) => {
  return (nextVm: VM): void => {
    setClearedLineCount(nextVm.lines.length);
    setClearedItemCount(nextVm.items.length);
  };
};

type AppFrameHandlers = {
  handleSubmit: ReturnType<typeof createSubmitHandler>;
  handleAbort: () => void;
  handleSlashCommand: ReturnType<typeof createSlashHandler>;
  handlePlanDecision: ReturnType<typeof createPlanDecisionHandler>;
  handleExit: () => void;
  handlePermissionDecision: ReturnType<typeof createPermissionDecisionHandler>;
};

type AppFrameHandlerParams = {
  vm: VM;
  appendLine: LocalLineWriter;
  onSubmit: AppProps['onSubmit'];
  onGate: AppProps['onGate'];
  onSlashCommand: AppProps['onSlashCommand'];
  onPlanDecision: AppProps['onPlanDecision'];
  onAbort: AppProps['onAbort'];
  pendingPlanEditTaskId: string | null;
  setPendingPlanEditTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  setDismissedPendingGateId: (gateId: string) => void;
  setClearedCursors: (nextVm: VM) => void;
  setLocalLines: React.Dispatch<React.SetStateAction<string[]>>;
  setDismissedPlanIdentity: (identity: PlanIdentity) => void;
};

const createFrameHandlers = (params: AppFrameHandlerParams): AppFrameHandlers => {
  const {
    vm,
    appendLine,
    onSubmit,
    onGate,
    onSlashCommand,
    onPlanDecision,
    onAbort,
    pendingPlanEditTaskId,
    setPendingPlanEditTaskId,
    setDismissedPendingGateId,
    setClearedCursors,
    setLocalLines,
    setDismissedPlanIdentity
  } = params;

  const handleSubmit = createSubmitHandler(
    onSubmit,
    onPlanDecision,
    pendingPlanEditTaskId,
    setPendingPlanEditTaskId,
    appendLine
  );
  const handleAbort = createAbortHandler(vm, appendLine, onAbort);
  const handleSlashCommand = createSlashHandler(
    vm,
    appendLine,
    setLocalLines,
    setClearedCursors,
    onSubmit,
    onSlashCommand
  );
  const handlePlanDecision = createPlanDecisionHandler(appendLine, vm, setPendingPlanEditTaskId, setDismissedPlanIdentity, onPlanDecision);
  const handleExit = createExitHandler(onSubmit);
  const handlePermissionDecision = createPermissionDecisionHandler(vm, onGate, setDismissedPendingGateId);
  return {
    handleSubmit,
    handleAbort,
    handleSlashCommand,
    handlePlanDecision,
    handleExit,
    handlePermissionDecision
  };
};

const useFrameVisibleContent = (
  vm: VM,
  localLines: string[],
  clearLineCount: number,
  clearItemCount: number
): { visibleItems: StreamItem[]; visibleLines: string[] } => {
  return getVisibleContent(vm, localLines, clearLineCount, clearItemCount);
};

const getAppFramePayload = (
  vm: VM,
  localLines: string[],
  clearedLineCount: number,
  clearedItemCount: number,
  dismissedPendingGateId: string | null
): {
  visibleItems: StreamItem[];
  visibleLines: string[];
  showPermissionPrompt: boolean;
} => {
  const frameContent = useFrameVisibleContent(vm, localLines, clearedLineCount, clearedItemCount);
  return {
    visibleItems: frameContent.visibleItems,
    visibleLines: frameContent.visibleLines,
    showPermissionPrompt: Boolean(vm.pendingGate && vm.pendingGate.gateId !== dismissedPendingGateId)
  };
};

function useAppFrameProps({
  host,
  initialVm,
  onSubmit,
  onGate,
  onSlashCommand,
  onPlanDecision,
  onAbort
}: AppProps): AppFrameProps {
  const vm = useViewModel(host, initialVm);
  const [localLines, setLocalLines] = useState<string[]>([]);
  const [clearedLineCount, setClearedLineCount] = useState(0);
  const [clearedItemCount, setClearedItemCount] = useState(0);
  const [pendingPlanEditTaskId, setPendingPlanEditTaskId] = useState<string | null>(null);
  const [dismissedPendingGateId, setDismissedPendingGateId] = useDismissedPendingGate(vm.pendingGate);
  const [showPlanView, setDismissedPlanIdentity] = usePlanVisibility(vm);

  const appendLine = createLineWriter(setLocalLines);
  const setClearedCursors = createFrameCursors(setClearedLineCount, setClearedItemCount);
  const handlers = createFrameHandlers({
    vm,
    appendLine,
    onSubmit,
    onGate,
    onSlashCommand,
    onPlanDecision,
    onAbort,
    pendingPlanEditTaskId,
    setPendingPlanEditTaskId,
    setDismissedPendingGateId,
    setClearedCursors,
    setLocalLines,
    setDismissedPlanIdentity
  });
  const framePayload = getAppFramePayload(vm, localLines, clearedLineCount, clearedItemCount, dismissedPendingGateId);

  return {
    vm,
    visibleItems: framePayload.visibleItems,
    visibleLines: framePayload.visibleLines,
    showPlanView,
    onPlanDecision: handlers.handlePlanDecision,
    onSubmit: handlers.handleSubmit,
    onAbort: handlers.handleAbort,
    onExit: handlers.handleExit,
    onSlashCommand: handlers.handleSlashCommand,
    onPermissionDecision: handlers.handlePermissionDecision,
    showPermissionPrompt: framePayload.showPermissionPrompt
  };
}

export function App(props: AppProps) {
  return <AppFrame {...useAppFrameProps(props)} />;
}
