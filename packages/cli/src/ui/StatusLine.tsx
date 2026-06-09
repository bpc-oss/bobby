import React from 'react';
import { Text } from 'ink';
import type { VM } from './view-model';

type StatusLineProps = {
  vm: VM;
};

const statusIcon: Record<string, string> = {
  idle: '○',
  running: '◉',
  done: '✓',
  failed: '✗',
  blocked: '⊘'
};

const formatStatusLine = (vm: VM): string[] => {
  const pieces: string[] = [
    `${statusIcon[vm.status] ?? '?'} ${vm.status}`
  ];

  if (vm.usageModel) {
    pieces.push(vm.usageModel);
  }

  if (typeof vm.spentUsd === 'number') {
    pieces.push(`$${vm.spentUsd.toFixed(2)}`);
  }

  if (typeof vm.costUsd === 'number' && typeof vm.spentUsd !== 'number') {
    pieces.push(`$${vm.costUsd.toFixed(4)}`);
  }

  return pieces;
};

export function StatusLine({ vm }: StatusLineProps): JSX.Element {
  return <Text>{formatStatusLine(vm).join(' | ')}</Text>;
}
