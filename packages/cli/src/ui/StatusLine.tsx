import React from 'react';
import { Text } from 'ink';
import type { VM } from './view-model';

type StatusLineProps = {
  vm: VM;
};

export function StatusLine({ vm }: StatusLineProps): JSX.Element {
  const status = (() => {
    if (vm.status === 'running') {
      return 'running';
    }
    if (vm.status === 'idle') {
      return 'idle';
    }
    return 'final';
  })();

  const pieces: string[] = [`status: ${status}`];

  pieces.push(`stream: ${vm.streamingMode}`);

  if (status === 'running') {
    pieces.push('spinner: *');
  }

  if (vm.currentActivity) {
    pieces.push(`activity: ${vm.currentActivity}`);
  }

  if (typeof vm.spentUsd === 'number') {
    pieces.push(`spentUsd: $${vm.spentUsd.toFixed(2)}`);
  }
  if (typeof vm.proCalls === 'number') {
    pieces.push(`proCalls: ${vm.proCalls}`);
  }
  if (typeof vm.flashCalls === 'number') {
    pieces.push(`flashCalls: ${vm.flashCalls}`);
  }
  if (typeof vm.contextPercent === 'number') {
    pieces.push(`contextPercent: ${vm.contextPercent.toFixed(2)}%`);
  }

  return <Text>{pieces.join(' | ')}</Text>;
}
