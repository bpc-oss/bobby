import React from 'react';
import { Box, Text, useInput } from 'ink';

export type PermissionDecision = 'allow' | 'deny';

type PermissionPromptProps = {
  gateId: string;
  reason: string;
  onDecision: (decision: PermissionDecision) => void;
};

export function permissionKeyToDecision(input: string): PermissionDecision | null {
  const normalized = input.toLowerCase();
  if (normalized === 'a') {
    return 'allow';
  }

  if (normalized === 'd') {
    return 'deny';
  }

  return null;
};

export function PermissionPrompt({ gateId, reason, onDecision }: PermissionPromptProps): JSX.Element {
  useInput((input) => {
    const decision = permissionKeyToDecision(input);
    if (decision) {
      onDecision(decision);
    }
  });

  return (
    <Box flexDirection="column">
      <Text color="yellow">{`[permission] ${reason}`}</Text>
      <Text>[a]llow once    [A]lways    [d]eny</Text>
      <Text color="gray">{`gate id: ${gateId}`}</Text>
    </Box>
  );
}
