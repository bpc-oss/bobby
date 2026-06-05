import { afterEach, expect, it, vi } from 'vitest';

import { makeDeepSeekClientFromBobbyConfig, DEFAULT_DEEPSEEK_BASE_URL, loadDeepSeekConfig } from '../src/model/deepseek/factory';
import { join } from 'node:path';

const createReadFile = (files: Map<string, string>) => {
  const readFile = async (path: string): Promise<string> => {
    const key = path.replace(/\\\\/g, '/');
    const value = files.get(key);
    if (value === undefined) {
      const err = new Error(`ENOENT: ${path}`);
      (err as NodeJS.ErrnoException).code = 'ENOENT';
      throw err;
    }
    return value;
  };

  return readFile;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

it('loads key/capabilities from injected home dir and creates client using default base URL', async () => {
  const homeDir = 'C:\\\\Users\\\\admin';
  const readFile = createReadFile(
    new Map([
      [join(homeDir, '.bobby', 'key').replace(/\\\\/g, '/'), 'deepseek-key'],
      [
        join(homeDir, '.bobby', 'capabilities.json').replace(/\\\\/g, '/'),
        JSON.stringify({
          runnerModel: 'deepseek-v4-flash',
          graderModel: 'deepseek-v4-pro',
          useToolCalling: true,
          useJsonMode: true,
          useFim: false,
          useCaching: false,
          useReasoning: true,
          contextWindow: 128000
        })
      ]
    ])
  );

  const fetchMock = vi.fn(async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
        model: 'deepseek-v4-flash',
        usage: { prompt_tokens: 1, completion_tokens: 1 }
      })
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);

  const client = await makeDeepSeekClientFromBobbyConfig({ homeDir, readFile });
  const response = await client.complete('runner', [{ role: 'user', content: 'hello' }]);

  expect(response.content).toBe('ok');
  const firstCall = fetchMock.mock.calls[0] as Array<unknown> | undefined;
  if (!firstCall || firstCall.length < 2 || firstCall[1] === undefined) {
    throw new Error('fetch not called with expected request body');
  }

  const requestBody = JSON.parse((firstCall[1] as { body: string }).body);
  expect(fetchMock).toHaveBeenCalledWith(`${DEFAULT_DEEPSEEK_BASE_URL}/chat/completions`, expect.any(Object));
  expect(requestBody.model).toBe('deepseek-v4-flash');
});

it('throws clear errors when key is missing without leaking secrets', async () => {
  const homeDir = '/tmp/bobby';
  const readFile = createReadFile(
    new Map([[join(homeDir, '.bobby', 'capabilities.json').replace(/\\\\/g, '/'), JSON.stringify({})]])
  );

  await expect(makeDeepSeekClientFromBobbyConfig({ homeDir, readFile })).rejects.toThrow(
    /DeepSeek Key|~\/.bobby\/key/i
  );
});

it('throws clear errors when capabilities is missing without leaking secrets', async () => {
  const homeDir = '/tmp/bobby';
  const readFile = createReadFile(
    new Map([[join(homeDir, '.bobby', 'key').replace(/\\\\/g, '/'), 'deepseek-key']])
  );

  await expect(makeDeepSeekClientFromBobbyConfig({ homeDir, readFile })).rejects.toThrow(
    /capabilities|\.bobby\/capabilities\.json/i
  );
});

it('validates capabilities structure during load', async () => {
  const homeDir = '/tmp/bobby';
  const readFile = createReadFile(
    new Map([
      [join(homeDir, '.bobby', 'key').replace(/\\\\/g, '/'), 'deepseek-key'],
      [join(homeDir, '.bobby', 'capabilities.json').replace(/\\\\/g, '/'), JSON.stringify({ contextWindow: 'bad' })]
    ])
  );

  await expect(loadDeepSeekConfig({ homeDir, readFile })).rejects.toThrow(/capabilities\\.json.*runnerModel|runne[rR]Model/i);
});

it('defaults missing useStreaming in older capability files to false', async () => {
  const homeDir = '/tmp/bobby';
  const readFile = createReadFile(
    new Map([
      [join(homeDir, '.bobby', 'key').replace(/\\\\/g, '/'), 'deepseek-key'],
      [
        join(homeDir, '.bobby', 'capabilities.json').replace(/\\\\/g, '/'),
        JSON.stringify({
          runnerModel: 'deepseek-v4-flash',
          graderModel: 'deepseek-v4-pro',
          useToolCalling: true,
          useJsonMode: true,
          useFim: false,
          useCaching: true,
          useReasoning: true,
          contextWindow: 128000
        })
      ]
    ])
  );

  const config = await loadDeepSeekConfig({ homeDir, readFile });

  expect(config.report.useStreaming).toBe(false);
});
