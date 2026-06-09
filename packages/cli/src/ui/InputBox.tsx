import React, { useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import {
  type ParsedInputLine,
  type SlashCommandInput,
  type UnknownSlashCommandInput,
  parseInputLine,
  makeInitialCtrlCState,
  updateCtrlCState
} from './input-commands';

type InputBoxProps = {
  onSubmit: (value: string) => void;
  onAbort?: () => void;
  onExit?: () => void;
  onCommand?: (command: SlashCommandInput | UnknownSlashCommandInput) => void;
};

type InputKeyEvent = Parameters<typeof useInput>[0];

type InputKey = Parameters<InputKeyEvent>[1];

type InputSubmitHandlerDeps = {
  onSubmit: InputBoxProps['onSubmit'];
  onCommand?: InputBoxProps['onCommand'];
  setHistoryDraft: React.Dispatch<React.SetStateAction<string>>;
  setHistory: React.Dispatch<React.SetStateAction<string[]>>;
  setHistoryIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setValue: React.Dispatch<React.SetStateAction<string>>;
};

type InputKeypressDeps = {
  history: string[];
  historyIndex: number | null;
  value: string;
  historyDraft: string;
  setHistoryDraft: React.Dispatch<React.SetStateAction<string>>;
  onAbort?: InputBoxProps['onAbort'];
  onExit?: InputBoxProps['onExit'];
  setHistoryIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  ctrlCState: { current: { lastPressedAt: number | null } };
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
  const shouldClearDraft = parsedInput.kind === 'slash' || trimmedValue.length > 0;

  if (parsedInput.kind === 'slash') {
    deps.onCommand?.(parsedInput);
  } else if (parsedInput.kind === 'unknown_slash') {
    deps.onCommand?.(parsedInput);
  } else if (trimmedValue) {
    deps.onSubmit(trimmedValue);
    addToHistory(deps.setHistory, trimmedValue);
  }

  if (shouldClearDraft) {
    deps.setHistoryDraft('');
  }

  deps.setValue('');
  deps.setHistoryIndex(null);
}

function resetInputNavigation(deps: InputKeypressDeps): void {
  deps.setValue('');
  deps.setHistoryDraft('');
  deps.setHistoryIndex(null);
}

function handleCtrlC(input: string, key: InputKey, deps: InputKeypressDeps): boolean {
  if (!isCtrlC(input, key)) {
    return false;
  }

  const { shouldAbort, shouldExit, nextState } = updateCtrlCState(deps.ctrlCState.current, Date.now());
  deps.ctrlCState.current = nextState;
  if (shouldAbort) {
    deps.onAbort?.();
    resetInputNavigation(deps);
    return true;
  }

  if (shouldExit) {
    deps.onExit?.();
    resetInputNavigation(deps);
  }

  return true;
}

function handleInputKeypress(input: string, key: InputKey, deps: InputKeypressDeps): void {
  if (key.escape) {
    deps.onAbort?.();
    resetInputNavigation(deps);
    return;
  }

  if (handleCtrlC(input, key, deps)) {
    return;
  }

  if (key.upArrow || key.downArrow) {
    const direction: 'up' | 'down' = key.upArrow ? 'up' : 'down';
    const historyDraft =
      direction === 'up' && deps.historyIndex === null ? deps.value : deps.historyDraft;
    const next = getNextHistoryValue(deps.history, deps.historyIndex, direction, historyDraft);
    if (direction === 'up' && deps.historyIndex === null) {
      deps.setHistoryDraft(historyDraft);
    }
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
  direction: 'up' | 'down',
  draft: string
): { nextIndex: number | null; nextValue: string } {
  if (history.length === 0) {
    return { nextIndex: null, nextValue: draft };
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
    return { nextIndex: null, nextValue: draft };
  }

  return { nextIndex, nextValue: history[nextIndex] };
}

export function InputBox({ onSubmit, onAbort, onExit, onCommand }: InputBoxProps): JSX.Element {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [historyDraft, setHistoryDraft] = useState('');
  const ctrlCState = useRef(makeInitialCtrlCState());

  useInput((input, key) => {
    handleInputKeypress(input, key, {
      history,
      historyIndex,
      value,
      historyDraft,
      setHistoryDraft,
      onAbort,
      onExit,
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
            setHistoryDraft,
            setHistory,
            setHistoryIndex,
            setValue
          });
        }}
      />
    </Box>
  );
}
