import type { Evidence } from '@bobby/shared';
import type { KernelEvent } from '@bobby/shared';
import { expect, it } from 'vitest';
import { render } from 'ink-testing-library';

import { EvidenceLine } from '../src/ui/EvidenceLine';
import { ToolCallLine } from '../src/ui/ToolCallLine';

const toolCalled: KernelEvent = {
  type: 'tool_called',
  taskId: 'task-1',
  stepId: 'step-1',
  tool: 'exec node --version'
};

const commandEvidence: Evidence = {
  claimId: 'C1',
  acId: 'AC1',
  evidenceType: 'command_output',
  payload: {
    exitCode: 0,
    stdout: 'v20.14.0\n'
  },
  producedBy: 'tool'
};

const failEvidence: Evidence = {
  claimId: 'C1',
  acId: 'AC1',
  evidenceType: 'test_run',
  payload: {
    exitCode: 1,
    stderr: 'boom' // no newline so concise check is stable
  },
  producedBy: 'tool'
};

const diffEvidence: Evidence = {
  claimId: 'C1',
  acId: 'AC1',
  evidenceType: 'file_diff',
  payload: {
    path: 'README.md',
    bytes: 44
  },
  producedBy: 'tool'
};

it('renders inline tool call line from event payload', () => {
  const { lastFrame } = render(<ToolCallLine event={toolCalled} />);

  expect(lastFrame()).toContain('* exec(node --version)');
});

it('renders successful command evidence with green styling context', () => {
  const { lastFrame } = render(<EvidenceLine evidence={commandEvidence} />);

  expect(lastFrame()).toContain('command_output(exitCode=0');
  expect(lastFrame()).toContain('stdout: v20.14.0');
});

it('renders failed test_run evidence with red styling context', () => {
  const { lastFrame } = render(<EvidenceLine evidence={failEvidence} />);

  expect(lastFrame()).toContain('test_run(exitCode=1');
  expect(lastFrame()).toContain('stderr: boom');
});

it('renders file diff evidence with path and bytes', () => {
  const { lastFrame } = render(<EvidenceLine evidence={diffEvidence} />);

  expect(lastFrame()).toContain('file_diff(path=README.md, bytes=44)');
});
