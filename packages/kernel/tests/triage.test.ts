import { describe, expect, it } from 'vitest';

import { classifyIntent } from '../src/brain/triage';

describe('triage', () => {
  const expectIntent = async (input: string, expected: string): Promise<void> => {
    expect(await classifyIntent(input)).toBe(expected);
  };

  it.each([
    ['你好', 'GREETING'],
    ['?', 'QUESTION'],
    ['', 'UNCLEAR'],
    [' ', 'UNCLEAR'],
    ['。', 'UNCLEAR'],
    ['a', 'UNCLEAR'],
    ['aa', 'UNCLEAR'],
    ['帮我建 hello.txt', 'TASK'],
    ['我想让你帮我想一想', 'TASK'],
    ['帮我删除这个文件 hello.txt?', 'TASK'],
    ['你能帮我建 hello.txt 吗', 'TASK'],
    ['帮我写一个 README.md 可以吗', 'TASK'],
    ['把 README.md 改成英文吗', 'TASK']
  ])('%s => %s', async (input, expected) => {
    await expectIntent(input, expected);
  });
});
