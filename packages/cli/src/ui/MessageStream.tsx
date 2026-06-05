import React from 'react';
import { Box, Text } from 'ink';
import type { StreamItem } from './view-model';
import { EvidenceLine } from './EvidenceLine';
import { ToolCallLine } from './ToolCallLine';

type MessageStreamProps = {
  lines: string[];
  items?: StreamItem[];
};

function renderItem(item: StreamItem, index: number): JSX.Element {
  if (item.kind === 'tool') {
    return <ToolCallLine key={index} event={item.event} />;
  }

  if (item.kind === 'evidence') {
    return <EvidenceLine key={index} evidence={item.evidence} />;
  }

  return <Text key={index}>{item.text}</Text>;
}

export function MessageStream({ lines, items }: MessageStreamProps): JSX.Element {
  const streamItems = items ?? lines.map((text) => ({ kind: 'line' as const, text }));

  return (
    <Box flexDirection="column">
      {streamItems.map((item, index) => renderItem(item, index))}
    </Box>
  );
}
