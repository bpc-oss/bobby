import { describe, expect, it } from 'vitest';

import { classifyIntent } from '../src/brain/triage';

describe('triage', () => {
  it('classifies greeting text as GREETING', async () => {
    expect(await classifyIntent('你好')).toBe('GREETING');
  });

  it('classifies simple question text as QUESTION', async () => {
    expect(await classifyIntent('?')).toBe('QUESTION');
  });

  it('classifies explicit file-change intent as TASK', async () => {
    expect(await classifyIntent('帮我建 hello.txt')).toBe('TASK');
  });

  it('defaults ambiguous input to TASK', async () => {
    expect(await classifyIntent('我想让你帮我想一想')).toBe('TASK');
  });

it('keeps file mutation intent in TASK even when phrased as a question', async () => {
  expect(await classifyIntent('帮我删除这个文件 hello.txt?')).toBe('TASK');
});

it('classifies file create intent as TASK even with question phrasing', async () => {
  expect(await classifyIntent('你能帮我建 hello.txt 吗')).toBe('TASK');
});

it('classifies file write intent as TASK when file extension is present', async () => {
  expect(await classifyIntent('帮我写一个 README.md 可以吗')).toBe('TASK');
});

it('classifies file update intent as TASK when extension + action is present', async () => {
  expect(await classifyIntent('把 README.md 改成英文吗')).toBe('TASK');
});
});
