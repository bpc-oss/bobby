import { describe, expect, it } from 'vitest';

import {
  parseInputLine,
  updateCtrlCState,
  makeInitialCtrlCState,
  slashCommands,
  isKnownSlashCommand
} from '../src/ui/input-commands';

describe('parseInputLine', () => {
  it('parses known slash commands', () => {
    for (const command of slashCommands) {
      const result = parseInputLine(`/${command}`);
      expect(result).toMatchObject({ kind: 'slash', command });
    }
  });

  it('is case-insensitive and trims', () => {
    expect(parseInputLine('   /Help   test ')).toMatchObject({
      kind: 'slash',
      command: 'help',
      args: ['test']
    });
  });

  it('keeps non-command text as text input', () => {
    expect(parseInputLine('hello world')).toEqual({ kind: 'text', value: 'hello world' });
    expect(parseInputLine('/unknown thing')).toEqual({ kind: 'text', value: '/unknown thing' });
  });
});

describe('slash command helpers', () => {
  it('recognizes known slash command names', () => {
    expect(isKnownSlashCommand('status')).toBe(true);
    expect(isKnownSlashCommand('not-real')).toBe(false);
  });
});

describe('double Ctrl+C helper', () => {
  it('detects abort on second press inside the window', () => {
    const baseState = makeInitialCtrlCState();

    const first = updateCtrlCState(baseState, 1000);
    expect(first).toMatchObject({ aborted: false, nextState: { lastPressedAt: 1000 } });

    const second = updateCtrlCState(first.nextState, 1200);
    expect(second).toMatchObject({ aborted: true, nextState: { lastPressedAt: null } });
  });

  it('resets after timeout window misses a second press', () => {
    const first = updateCtrlCState(makeInitialCtrlCState(), 1000);
    const second = updateCtrlCState(first.nextState, 1700);
    expect(second).toMatchObject({ aborted: false, nextState: { lastPressedAt: 1700 } });
  });
});
