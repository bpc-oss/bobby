import React from 'react';
import { Text } from 'ink';
import type { VM } from './view-model';

type StatusLineProps = {
  vm: VM;
};

const formatStatusLine = (vm: VM): string[] => {
  const status = vm.status;

  const pieces = [
    `status: ${status}`,
    `stream: ${vm.streamingMode}`,
    vm.status === 'running' ? 'spinner: *' : undefined,
    vm.currentActivity && `activity: ${vm.currentActivity}`,
    vm.usageModel && `model=${vm.usageModel}`,
    typeof vm.promptTokens === 'number' && `prompt=${vm.promptTokens}`,
    typeof vm.completionTokens === 'number' && `completion=${vm.completionTokens}`,
    typeof vm.cachedTokens === 'number' && `cached=${vm.cachedTokens}`,
    typeof vm.spentUsd === 'number' && `spentUsd: $${vm.spentUsd.toFixed(2)}`,
    typeof vm.costUsd === 'number' && `cost=$${vm.costUsd}`,
    typeof vm.proCalls === 'number' && `proCalls: ${vm.proCalls}`,
    typeof vm.flashCalls === 'number' && `flashCalls: ${vm.flashCalls}`,
    typeof vm.contextPercent === 'number' && `contextPercent: ${vm.contextPercent.toFixed(2)}%`
  ];

  return pieces.filter((piece): piece is string => typeof piece === 'string');
};

export function StatusLine({ vm }: StatusLineProps): JSX.Element {
  return <Text>{formatStatusLine(vm).join(' | ')}</Text>;
}
