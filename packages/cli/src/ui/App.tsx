import { Box } from 'ink';
import React, { useEffect, useState } from 'react';
import type { KernelEvent } from '@bobby/shared';
import type { VM, StreamItem } from './view-model';
import { initialVM, reduceEvent } from './view-model';
import { InputBox } from './InputBox';
import { MessageStream } from './MessageStream';
import { StatusLine } from './StatusLine';
import { PermissionPrompt } from './PermissionPrompt';
import { PlanView } from './PlanView';
import type { SlashCommandInput } from './input-commands';

type AppProps = {
  host?: {
    subscribe: (fn: (event: KernelEvent) => void) => () => void;
  };
  initialVm?: VM;
  onSubmit: (s: string) => void | Promise<void>;
  onGate: (gateId: string, decision: 'allow' | 'deny') => void | Promise<void>;
  onAbort?: (taskId: string) => void | Promise<void>;
};

type LocalLineWriter = (line: string) => void;

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

const slashHelpLine = (): string =>
  'commands: /help /clear /status /cost /undo /agents /resume /exit';

const localLine = (text: string): StreamItem => ({ kind: 'line', text });

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

const createSlashHandler = (
  vm: VM,
  appendLocalLine: LocalLineWriter,
  setLocalLines: React.Dispatch<React.SetStateAction<string[]>>,
  onSubmit: AppProps['onSubmit']
): ((input: SlashCommandInput) => void) => (input) => {
  if (input.command === 'exit') {
    void onSubmit('/exit');
    return;
  }

  if (input.command === 'clear') {
    setLocalLines([]);
    return;
  }

  if (input.command === 'help') {
    appendLocalLine(slashHelpLine());
    return;
  }

  appendLocalLine(input.command === 'status' ? `status: ${vm.status}` : `/${input.command}: not wired yet`);
};

const createPlanDecisionHandler = (
  appendLocalLine: LocalLineWriter,
  handleAbort: () => void
): ((decision: 'approve' | 'edit' | 'reject') => void) => (decision) => {
  appendLocalLine(`plan decision: ${decision}`);
  if (decision === 'reject') {
    handleAbort();
  }
};

export function App({ host, initialVm, onSubmit, onGate, onAbort }: AppProps) {
  const vm = useViewModel(host, initialVm);
  const [localLines, setLocalLines] = useState<string[]>([]);

  const appendLocalLine = (line: string): void => {
    setLocalLines((previous) => [...previous, line]);
  };

  const handleSubmit = (value: string): void => {
    const line = value.trim();
    if (!line) {
      return;
    }

    void onSubmit(line);
  };

  const handleAbort = createAbortHandler(vm, appendLocalLine, onAbort);
  const handleSlashCommand = createSlashHandler(vm, appendLocalLine, setLocalLines, onSubmit);
  const handlePlanDecision = createPlanDecisionHandler(appendLocalLine, handleAbort);
  const visibleItems = [...vm.items, ...localLines.map(localLine)];
  const visibleLines = [...vm.lines, ...localLines];

  return (
    <Box flexDirection="column">
      <MessageStream lines={visibleLines} items={visibleItems} />
      {vm.currentPlan.length > 0 && vm.status === 'running' ? (
        <PlanView steps={vm.currentPlan} onDecision={handlePlanDecision} />
      ) : null}
      <StatusLine vm={vm} />
      <InputBox onSubmit={handleSubmit} onAbort={handleAbort} onCommand={handleSlashCommand} />
      {vm.pendingGate ? (
        <PermissionPrompt
          gateId={vm.pendingGate.gateId}
          reason={vm.pendingGate.reason}
          onDecision={(decision) => void onGate(vm.pendingGate!.gateId, decision)}
        />
      ) : null}
    </Box>
  );
}
