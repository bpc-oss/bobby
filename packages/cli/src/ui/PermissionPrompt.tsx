import React from 'react';
import { Box, Text, useInput } from 'ink';

export type PermissionDecision = 'allow' | 'always' | 'deny';

type PermissionPromptProps = {
  reason: string;
  onDecision: (decision: PermissionDecision) => void;
};

export function permissionKeyToDecision(input: string): PermissionDecision | null {
  if (input === 'a') {
    return 'allow';
  }

  if (input === 'A') {
    return 'always';
  }

  if (input === 'd') {
    return 'deny';
  }

  return null;
};

export function PermissionPrompt({ reason, onDecision }: PermissionPromptProps): JSX.Element {
  useInput((input) => {
    const decision = permissionKeyToDecision(input);
    if (decision) {
      onDecision(decision);
    }
  });

  return (
    <Box flexDirection="column">
      <Text color="yellow">{`[permission] ${reason}`}</Text>
      <Text>[a]llow once   [A]lways   [d]eny</Text>
    </Box>
  );
}
