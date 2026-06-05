import { describe, expect, it } from 'vitest';
import type { Evidence } from '@bobby/shared';

import { formatEvidenceLine, formatToolCalledLine, type EvidenceDisplay } from '../src/ui/tool-lines';

it('formats tool calls with tool name and key arguments', () => {
  expect(formatToolCalledLine('exec node --version')).toBe('* exec(node --version)');
  expect(formatToolCalledLine('write_file')).toBe('* write_file()');
  expect(formatToolCalledLine('bash   -lc "echo hi"')).toBe('* bash(-lc "echo hi")');
});

describe('formatEvidenceLine', () => {
  it('formats command_output with exit code and stdout summary', () => {
    const commandOutput: Evidence = {
      claimId: 'C1',
      acId: 'AC1',
      evidenceType: 'command_output',
      payload: {
        exitCode: 0,
        stdout: 'hello\nworld',
        stderr: ''
      },
      producedBy: 'tool'
    };

    const formatted = formatEvidenceLine(commandOutput);

    expect(formatted).toMatchObject<EvidenceDisplay>({
      severity: 'pass',
      text: expect.stringContaining('* command_output(exitCode=0')
    });
    expect(formatted.text).toContain('stdout: hello world');
  });

  it('formats failed test_run with stderr summary', () => {
    const testRun: Evidence = {
      claimId: 'C1',
      acId: 'AC1',
      evidenceType: 'test_run',
      payload: {
        exitCode: 1,
        stderr: 'assert failed: got 2 expected 3',
        stdout: 'ignored\n'
      },
      producedBy: 'tool'
    };

    const formatted = formatEvidenceLine(testRun);

    expect(formatted).toMatchObject<EvidenceDisplay>({
      severity: 'fail',
      text: expect.stringContaining('* test_run(exitCode=1')
    });
    expect(formatted.text).toContain('stderr: assert failed: got 2 expected 3');
  });
});

describe('formatEvidenceLine file diffs', () => {
  it('formats file_diff with path and bytes', () => {
    const fileDiff: Evidence = {
      claimId: 'C1',
      acId: 'AC1',
      evidenceType: 'file_diff',
      payload: {
        path: 'src/index.ts',
        bytes: 128,
      },
      producedBy: 'tool'
    };

    const formatted = formatEvidenceLine(fileDiff);

    expect(formatted.severity).toBe('neutral');
    expect(formatted.text).toContain('file_diff(');
    expect(formatted.text).toContain('path=src/index.ts');
    expect(formatted.text).toContain('bytes=128');
  });
});
