export type Intent = 'GREETING' | 'QUESTION' | 'TASK' | 'COMMAND' | 'UNCLEAR';

export interface TriageDeps {
  classifyWithModel?: (input: string) => Promise<Intent | null>;
}

const GREETING_TOKENS = [
  '你好',
  '您好',
  '嗨',
  'hi',
  'hello',
  'hey',
  '早上好',
  '中午好',
  '下午好',
  '晚上好',
  '晚安',
  '你好呀'
];
const FILE_MUTATION_ACTIONS = [
  '创建',
  '新增',
  '新建',
  '建',
  '修正',
  '改写',
  '改动',
  '删除',
  '删',
  '删掉',
  '移除',
  '生成',
  '写入',
  '写',
  '保存',
  '更新',
  '改',
  '改成',
  '替换',
  'create',
  'make',
  'add',
  'modify',
  'edit',
  'remove',
  'delete',
  'rename',
  'generate',
  'save',
  'write',
  'update',
  'mkdir',
  'rm',
  'touch'
];
const FILE_REFERENCE_TOKENS = ['文件', 'file', '文件夹', 'README', 'readme', '文档'];
const FILE_EXTENSION_RE =
  /(?:^|[\s(「『'"\[\{【\u3000])([a-z0-9._-]+\.[a-z0-9]{1,12})(?=[\s)\]』”"\u201d,，。!?！？;；:：]|$)/i;
const QUESTION_TOKENS = [
  '?',
  '？',
  'what',
  'who',
  'where',
  'when',
  'how',
  'which',
  'can',
  'could',
  'should',
  'would',
  '叫',
  '啥',
  '啊',
  '什么',
  '为什么',
  '如何',
  '怎么',
  '哪里',
  '多少'
];
const COMMAND_TOKENS = ['help', 'ls', 'pwd', 'git status', 'git log', 'git diff', 'git branch', 'git pull', 'git push', 'git clone', 'cd ', 'clear', 'history', 'date', 'whoami', 'node ', 'pnpm ', 'npm ', 'python ', 'python3 ', 'bash ', 'zsh ', 'll '];

const normalize = (input: string): string => input.trim().toLowerCase();

const stripPunctuation = (input: string): string =>
  input
    .replace(/[!！,，.。?？;；:：\n\r\t ]+/g, '')
    .toLowerCase();

const startsWithCommand = (input: string): boolean =>
  COMMAND_TOKENS.some((token) => {
    const lower = input.toLowerCase();
    return lower === token.trim() || lower.startsWith(token);
  });

const containsKeyword = (input: string, tokens: string[]): boolean =>
  tokens.some((token) => input.includes(token));

const hasFileReference = (input: string): boolean =>
  FILE_REFERENCE_TOKENS.some((token) => input.includes(token.toLowerCase())) || FILE_EXTENSION_RE.test(input);

const isFileMutationIntent = (input: string): boolean => {
  const hasAction = containsKeyword(input, FILE_MUTATION_ACTIONS);
  return hasAction && hasFileReference(input);
};
const isGreeting = (input: string): boolean => {
  const compact = stripPunctuation(normalize(input));
  return GREETING_TOKENS.some((token) => compact === token);
};
const isSimpleQuestion = (input: string): boolean =>
  input.trim().endsWith('?') ||
  input.trim().endsWith('？') ||
  containsKeyword(normalize(input), QUESTION_TOKENS);

const isDegenerateInput = (input: string): boolean => {
  const trimmed = input.trim();
  if (!trimmed) {
    return true;
  }

  const compact = stripPunctuation(trimmed);
  if (!compact) {
    return true;
  }

  return compact.length <= 2;
};

export const classifyIntent = async (
  input: string,
  deps: TriageDeps = {}
): Promise<Intent> => {
  if (isFileMutationIntent(input)) {
    return 'TASK';
  }

  if (isGreeting(input)) {
    return 'GREETING';
  }

  if (isSimpleQuestion(input)) {
    return 'QUESTION';
  }

  if (startsWithCommand(input)) {
    return 'COMMAND';
  }

  if (isDegenerateInput(input)) {
    return 'UNCLEAR';
  }

  if (deps.classifyWithModel) {
    const modelResult = await deps.classifyWithModel(input);
    if (modelResult) {
      return modelResult;
    }
  }

  return 'TASK';
};
