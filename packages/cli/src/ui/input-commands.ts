export const slashCommands = [
  'help',
  'clear',
  'status',
  'cost',
  'undo',
  'agents',
  'resume',
  'exit'
] as const;

export type SlashCommand = (typeof slashCommands)[number];

export const supportedSlashCommands = new Set<SlashCommand>(slashCommands);

export type SlashCommandInput = {
  kind: 'slash';
  command: SlashCommand;
  args: string[];
  normalized: string;
};

export type TextInput = {
  kind: 'text';
  value: string;
};

export type ParsedInputLine = SlashCommandInput | TextInput;

const CONTINUE_WINDOW_MS = 500;

type CtrlCState = {
  lastPressedAt: number | null;
};

export const isKnownSlashCommand = (value: string): value is SlashCommand =>
  supportedSlashCommands.has(value as SlashCommand);

export function parseInputLine(rawInput: string): ParsedInputLine {
  const trimmed = rawInput.trim();
  if (!trimmed || !trimmed.startsWith('/')) {
    return { kind: 'text', value: trimmed };
  }

  const textWithoutSlash = trimmed.slice(1);
  if (!textWithoutSlash) {
    return { kind: 'text', value: trimmed };
  }

  const [command, ...args] = textWithoutSlash.split(/\s+/);
  const normalized = command.toLowerCase();
  if (!isKnownSlashCommand(normalized)) {
    return { kind: 'text', value: trimmed };
  }

  return {
    kind: 'slash',
    command: normalized,
    args,
    normalized: trimmed
  };
}

export function makeInitialCtrlCState(): CtrlCState {
  return { lastPressedAt: null };
}

export function updateCtrlCState(state: CtrlCState, now: number): { aborted: boolean; nextState: CtrlCState } {
  if (state.lastPressedAt !== null && now - state.lastPressedAt <= CONTINUE_WINDOW_MS) {
    return { aborted: true, nextState: { lastPressedAt: null } };
  }

  return { aborted: false, nextState: { lastPressedAt: now } };
}
