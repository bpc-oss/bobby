import React, { useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import {
  type ParsedInputLine,
  type SlashCommandInput,
  parseInputLine,
  makeInitialCtrlCState,
  updateCtrlCState
} from './input-commands';

type InputBoxProps = {
  onSubmit: (value: string) => void;
  onAbort?: () => void;
  onCommand?: (command: SlashCommandInput) => void;
};

type InputKeyEvent = Parameters<typeof useInput>[0];

type InputKey = Parameters<InputKeyEvent>[1];

type InputSubmitHandlerDeps = {
  onSubmit: InputBoxProps['onSubmit'];
  onCommand?: InputBoxProps['onCommand'];
  setHistory: React.Dispatch<React.SetStateAction<string[]>>;
  setHistoryIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setValue: React.Dispatch<React.SetStateAction<string>>;
};

function addToHistory(setHistory: React.Dispatch<React.SetStateAction<string[]>>, line: string): void {
  if (!line.length) {
    return;
  }
  setHistory((previous) => [...previous, line]);
}

function handleInputSubmit(input: string, deps: InputSubmitHandlerDeps): void {
  const parsedInput: ParsedInputLine = parseInputLine(input);
  const trimmedValue = input.trim();

  if (parsedInput.kind === 'slash') {
    deps.onCommand?.(parsedInput);
  } else if (trimmedValue) {
    deps.onSubmit(trimmedValue);
    addToHistory(deps.setHistory, trimmedValue);
  }

  deps.setValue('');
  deps.setHistoryIndex(null);
}

function handleInputKeypress(
  input: string,
  key: InputKey,
  deps: {
    history: string[];
    historyIndex: number | null;
    onAbort?: InputBoxProps['onAbort'];
    setHistoryIndex: React.Dispatch<React.SetStateAction<number | null>>;
    setValue: React.Dispatch<React.SetStateAction<string>>;
    ctrlCState: { current: { lastPressedAt: number | null } };
  }
): void {
  if (key.escape) {
    deps.onAbort?.();
    deps.setValue('');
    deps.setHistoryIndex(null);
    return;
  }

  if (isCtrlC(input, key)) {
    const { aborted, nextState } = updateCtrlCState(deps.ctrlCState.current, Date.now());
    deps.ctrlCState.current = nextState;
    if (aborted) {
      deps.onAbort?.();
      deps.setValue('');
      deps.setHistoryIndex(null);
    }
    return;
  }

  if (key.upArrow || key.downArrow) {
    const direction: 'up' | 'down' = key.upArrow ? 'up' : 'down';
    const next = getNextHistoryValue(deps.history, deps.historyIndex, direction);
    deps.setHistoryIndex(next.nextIndex);
    deps.setValue(next.nextValue);
  }
}

function isCtrlC(input: string, key: Parameters<InputKeyEvent>[1]): boolean {
  return key.ctrl && input.toLowerCase() === 'c';
}

function getNextHistoryValue(
  history: string[],
  currentIndex: number | null,
  direction: 'up' | 'down'
): { nextIndex: number | null; nextValue: string } {
  if (history.length === 0) {
    return { nextIndex: null, nextValue: '' };
  }

  if (direction === 'up') {
    if (currentIndex === null) {
      return { nextIndex: history.length - 1, nextValue: history[history.length - 1] };
    }

    const nextIndex = Math.max(currentIndex - 1, 0);
    return { nextIndex, nextValue: history[nextIndex] };
  }

  if (currentIndex === null) {
    return { nextIndex: null, nextValue: '' };
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex >= history.length) {
    return { nextIndex: null, nextValue: '' };
  }

  return { nextIndex, nextValue: history[nextIndex] };
}

export function InputBox({ onSubmit, onAbort, onCommand }: InputBoxProps): JSX.Element {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const ctrlCState = useRef(makeInitialCtrlCState());

  useInput((input, key) => {
    handleInputKeypress(input, key, {
      history,
      historyIndex,
      onAbort,
      setHistoryIndex,
      setValue,
      ctrlCState
    });
  });

  return (
    <Box>
      <Text color="gray">bobby&gt; </Text>
      <TextInput
        value={value}
        focus={true}
        onChange={setValue}
        onSubmit={(input) => {
          handleInputSubmit(input, {
            onSubmit,
            onCommand,
            setHistory,
            setHistoryIndex,
            setValue
          });
        }}
      />
    </Box>
  );
}
