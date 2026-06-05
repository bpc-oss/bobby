import React from 'react';
import { Text } from 'ink';
import type { KernelEvent } from '@bobby/shared';
import { formatToolCalledLine } from './tool-lines';

type ToolCallLineProps = {
  event: Extract<KernelEvent, { type: 'tool_called' }>;
};

export function ToolCallLine({ event }: ToolCallLineProps): JSX.Element {
  return <Text>{formatToolCalledLine(event.tool)}</Text>;
}
