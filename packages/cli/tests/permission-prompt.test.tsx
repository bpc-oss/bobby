import React from 'react';
import { expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import {
  PermissionPrompt,
  permissionKeyToDecision
} from '../src/ui/PermissionPrompt';

it('renders gate request reason and choices', () => {
  const { lastFrame } = render(
    <PermissionPrompt reason="Need human approval for deleting files" onDecision={vi.fn()} />
  );

  const frame = lastFrame();
  expect(frame).toContain('Need human approval for deleting files');
  expect(frame).toContain('[a]llow once');
  expect(frame).toContain('[A]lways');
  expect(frame).toContain('[d]eny');
  expect(frame).not.toContain('gate id:');
  expect(frame).not.toContain('g-1');
});

it('maps keyboard shortcuts to allow/deny decisions', () => {
  expect(permissionKeyToDecision('a')).toBe('allow');
  expect(permissionKeyToDecision('A')).toBe('always');
  expect(permissionKeyToDecision('d')).toBe('deny');
  expect(permissionKeyToDecision('x')).toBe(null);
});
