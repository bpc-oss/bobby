import React from 'react';
import { Text } from 'ink';
import type { Evidence } from '@bobby/shared';

import { formatEvidenceLine } from './tool-lines';

type EvidenceLineProps = {
  evidence: Evidence;
};

export function EvidenceLine({ evidence }: EvidenceLineProps): JSX.Element {
  const { text, severity } = formatEvidenceLine(evidence);

  const color = severity === 'pass' ? 'green' : severity === 'fail' ? 'red' : undefined;

  return <Text color={color}>{text}</Text>;
}
