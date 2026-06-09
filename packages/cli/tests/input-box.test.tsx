import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';

import { InputBox } from '../src/ui/InputBox';
import type { UnknownSlashCommandInput } from '../src/ui/input-commands';

type KeyCallback = Parameters<typeof import('ink')['useInput']>[0];
type MockKey = {
  upArrow?: boolean;
  downArrow?: boolean;
  escape?: boolean;
  ctrl?: boolean;
};

const flushPromises = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

let textInputProps: {
  value: string;
  onSubmit: (value: string) => void;
  onChange: (value: string) => void;
} | null = null;
let capturedUseInput: KeyCallback | null = null;

vi.mock('ink-text-input', () => ({
  default: ({
    value,
    onSubmit,
    onChange
  }: {
    value: string;
    onSubmit: (value: string) => void;
    onChange: (value: string) => void;
  }): JSX.Element => {
    textInputProps = { value, onSubmit, onChange };
    return <></>;
  }
}));

vi.mock('ink', async () => {
  const actual = await vi.importActual<typeof import('ink')>('ink');
  return {
    ...actual,
    useInput: (callback: KeyCallback): void => {
      capturedUseInput = callback;
    }
  };
});

const triggerSubmit = async (value: string): Promise<void> => {
  if (!textInputProps) {
    throw new Error('TextInput props were not captured');
  }
  textInputProps?.onSubmit(value);
  await flushPromises();
};

const triggerChange = async (value: string): Promise<void> => {
  if (!textInputProps) {
    throw new Error('TextInput props were not captured');
  }
  textInputProps?.onChange(value);
  await flushPromises();
};

const triggerKey = (input: string, key: MockKey): void => {
  if (!capturedUseInput) {
    throw new Error('useInput callback was not captured');
  }
  const callback = capturedUseInput as KeyCallback;
  callback(input, { ...key, return: false } as Parameters<KeyCallback>[1]);
};

const renderInputBox = (): void => {
  textInputProps = null;
  capturedUseInput = null;
};

const mountInputBox = async (
  props: Omit<React.ComponentProps<typeof InputBox>, 'onSubmit'> & {
    onSubmit?: (value: string) => void;
  }
): Promise<{ onSubmit: ReturnType<typeof vi.fn> }> => {
  const localOnSubmit = vi.fn();
  renderInputBox();
  render(<InputBox onSubmit={props.onSubmit ?? localOnSubmit} {...props} />);
  await flushPromises();
  return { onSubmit: localOnSubmit };
};

describe('InputBox submit flow', () => {
  it('submits plain text through onSubmit and stores history', async () => {
    const { onSubmit } = await mountInputBox({});
    await triggerChange('build docs');
    await triggerSubmit('build docs');
    expect(onSubmit).toHaveBeenCalledWith('build docs');
    expect(textInputProps?.value).toBe('');
  });

  it('routes slash commands to onCommand', async () => {
    const onSubmit = vi.fn();
    const onCommand = vi.fn();
    await mountInputBox({ onSubmit, onCommand });
    await triggerSubmit('/help');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCommand).toHaveBeenCalledWith({
      kind: 'slash',
      command: 'help',
      args: [],
      normalized: '/help'
    });
  });

  it('routes unknown slash commands to onCommand and does not call onSubmit', async () => {
    const onSubmit = vi.fn();
    const onCommand = vi.fn();
    await mountInputBox({ onSubmit, onCommand });
    await triggerSubmit('/unknown thing');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCommand).toHaveBeenCalledWith({
      kind: 'unknown_slash',
      command: 'unknown',
      args: ['thing'],
      normalized: '/unknown thing'
    } satisfies UnknownSlashCommandInput);
  });
});

describe('InputBox history', () => {
  it('replays command history with Up/Down keys', async () => {
    await mountInputBox({});
    await triggerSubmit('first');
    await triggerSubmit('second');
    triggerKey('', { upArrow: true });
    expect(textInputProps?.value).toBe('second');
    triggerKey('', { upArrow: true });
    expect(textInputProps?.value).toBe('first');
    triggerKey('', { downArrow: true });
    expect(textInputProps?.value).toBe('second');
  });

  it('restores the original draft when navigating down beyond latest history item', async () => {
    await mountInputBox({});
    await triggerSubmit('first');
    await triggerSubmit('second');
    await triggerChange('draft');
    triggerKey('', { upArrow: true });
    expect(textInputProps?.value).toBe('second');
    triggerKey('', { upArrow: true });
    expect(textInputProps?.value).toBe('first');
    triggerKey('', { downArrow: true });
    expect(textInputProps?.value).toBe('second');
    triggerKey('', { downArrow: true });
    expect(textInputProps?.value).toBe('draft');
  });

  it('keeps the draft unchanged when history is empty', async () => {
    await mountInputBox({});
    await triggerChange('draft');
    triggerKey('', { upArrow: true });
    expect(textInputProps?.value).toBe('draft');
    triggerKey('', { downArrow: true });
    expect(textInputProps?.value).toBe('draft');
  });
});

describe('InputBox abort', () => {
  it('fires onAbort on Escape', async () => {
    const onAbort = vi.fn();
    await mountInputBox({ onSubmit: () => {}, onAbort });
    triggerKey('', { escape: true });
    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it('fires onAbort on first Ctrl+C', async () => {
    const onAbort = vi.fn();
    await mountInputBox({ onSubmit: () => {}, onAbort });
    triggerKey('c', { ctrl: true });
    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it('fires onExit on second Ctrl+C within the continue window', async () => {
    const onAbort = vi.fn();
    const onExit = vi.fn();
    const nowSpy = vi.spyOn(Date, 'now');
    await mountInputBox({ onSubmit: () => {}, onAbort, onExit });
    nowSpy.mockReturnValueOnce(1000);
    nowSpy.mockReturnValueOnce(1300);
    triggerKey('c', { ctrl: true });
    triggerKey('c', { ctrl: true });
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });
});
