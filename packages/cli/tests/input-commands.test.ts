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

  it('parses /probe as known slash command', () => {
    expect(parseInputLine('/probe')).toMatchObject({ kind: 'slash', command: 'probe' });
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
  });

  it('treats unknown slash commands as unknown_slash', () => {
    expect(parseInputLine('/unknown thing')).toMatchObject({
      kind: 'unknown_slash',
      command: 'unknown',
      args: ['thing'],
      normalized: '/unknown thing'
    });
  });

  it('treats bare slash input as unknown slash', () => {
    expect(parseInputLine('/')).toEqual({ kind: 'unknown_slash', command: '', args: [], normalized: '/' });
  });
});

describe('slash command helpers', () => {
  it('recognizes known slash command names', () => {
    expect(isKnownSlashCommand('status')).toBe(true);
    expect(isKnownSlashCommand('not-real')).toBe(false);
  });
});

describe('double Ctrl+C helper', () => {
  it('maps first Ctrl+C press to abort', () => {
    const baseState = makeInitialCtrlCState();

    const first = updateCtrlCState(baseState, 1000);
    expect(first).toMatchObject({ shouldAbort: true, shouldExit: false, nextState: { lastPressedAt: 1000 } });
  });

  it('maps second Ctrl+C press inside the window to exit', () => {
    const first = updateCtrlCState(makeInitialCtrlCState(), 1000);
    const second = updateCtrlCState(first.nextState, 1200);
    expect(second).toMatchObject({ shouldAbort: false, shouldExit: true, nextState: { lastPressedAt: null } });
  });

  it('resets after timeout window misses a second press', () => {
    const first = updateCtrlCState(makeInitialCtrlCState(), 1000);
    const second = updateCtrlCState(first.nextState, 1700);
    expect(second).toMatchObject({ shouldAbort: true, shouldExit: false, nextState: { lastPressedAt: 1700 } });
  });
});
