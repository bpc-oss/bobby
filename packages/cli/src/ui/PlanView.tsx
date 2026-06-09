import React from 'react';
import { Box, Text, useInput } from 'ink';

import type { PlanStep } from '@bobby/shared';

type PlanDecision = 'approve' | 'edit' | 'reject';

type PlanViewProps = {
  steps: PlanStep[];
  onDecision: (decision: PlanDecision) => void;
};

export function PlanView({ steps, onDecision }: PlanViewProps): JSX.Element {
  useInput((input) => {
    if (input.toLowerCase() === 'a') {
      onDecision('approve');
      return;
    }

    if (input.toLowerCase() === 'e') {
      onDecision('edit');
      return;
    }

    if (input.toLowerCase() === 'r') {
      onDecision('reject');
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Plan</Text>
      <Box flexDirection="column" marginTop={1}>
        {steps.map((step) => (
          <Box key={step.id} flexDirection="column" marginBottom={1}>
            <Text>{`${step.id}: ${step.desc}`}</Text>
            {step.dependsOn.length > 0 ? (
              <Text color="gray">{`depends on ${step.dependsOn.join(', ')}`}</Text>
            ) : null}
          </Box>
        ))}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>Actions:</Text>
        <Text>[a] approve</Text>
        <Text>[e] edit</Text>
        <Text>[r] reject</Text>
      </Box>
    </Box>
  );
}
