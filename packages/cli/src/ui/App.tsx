import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { VM } from './view-model';

type AppProps = {
  vm: VM;
  onSubmit: (s: string) => void;
  onGate: (d: 'allow' | 'deny') => void;
};

function renderPrompt(vm: VM): JSX.Element {
  if (vm.pendingGate) {
    return <Text color="yellow">{`${vm.pendingGate.reason} [y/n]`}</Text>;
  }

  return <Text color="gray">{`status: ${vm.status}`}</Text>;
}

function renderLines(lines: string[]): JSX.Element[] {
  return lines.map((line, index) => <Text key={index}>{line}</Text>);
}

export function App({ vm, onSubmit, onGate }: AppProps) {
  useInput((input, key) => {
    if (vm.pendingGate) {
      if (input === 'y') {
        onGate('allow');
      } else if (input === 'n') {
        onGate('deny');
      }
      return;
    }

    if (key.return) {
      onSubmit('\n');
    }
  });

  return <Box flexDirection="column">{renderLines(vm.lines)}{renderPrompt(vm)}</Box>;
}
