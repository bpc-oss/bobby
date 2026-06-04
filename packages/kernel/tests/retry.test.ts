import { expect, it } from 'vitest';

import { withRetry } from '../src/model/deepseek/retry';

const makeErrorWithStatus = (status: number): Error => {
  const error = new Error(`status ${status}`) as Error & { status: number };
  error.status = status;
  return error;
};

it('retries on 429 then succeeds and returns the response', async () => {
  let attempt = 0;
  const sleepDelays: number[] = [];
  const value = await withRetry(
    async () => {
      if (attempt === 0) {
        attempt += 1;
        throw makeErrorWithStatus(429);
      }

      attempt += 1;
      return 'ok';
    },
    {
      retries: 2,
      baseMs: 8,
      sleep: async (ms) => {
        sleepDelays.push(ms);
      }
    }
  );

  expect(value).toBe('ok');
  expect(attempt).toBe(2);
  expect(sleepDelays).toEqual([8]);
});

it('retries on retriable statuses and finally throws the last error', async () => {
  const retries = 2;
  const baseMs = 10;
  let calls = 0;
  const delays: number[] = [];

  const pending = withRetry(
    async () => {
      calls += 1;
      throw makeErrorWithStatus(503);
    },
    {
      retries,
      baseMs,
      sleep: async (ms) => {
        delays.push(ms);
      }
    }
  );

  await expect(pending).rejects.toMatchObject({
    status: 503
  });

  expect(calls).toBe(1 + retries);
  expect(delays).toEqual([baseMs, baseMs * 2]);
});

it('does not retry non-retry statuses and throws immediately', async () => {
  const sleepDelays: number[] = [];
  let calls = 0;

  await expect(
    withRetry(
      async () => {
        calls += 1;
        throw makeErrorWithStatus(400);
      },
      {
        retries: 3,
        baseMs: 16,
        sleep: async (ms) => {
          sleepDelays.push(ms);
        }
      }
    )
  ).rejects.toMatchObject({
    status: 400
  });

  expect(calls).toBe(1);
  expect(sleepDelays).toEqual([]);
});

it('treats plain Error as non-retry by default', async () => {
  await expect(
    withRetry(
      async () => {
        throw new Error('network error');
      },
      {
        retries: 3,
        baseMs: 12,
        sleep: async () => {
          throw new Error('sleep should not run');
        }
      }
    )
  ).rejects.toMatchObject({
    message: 'network error'
  });
});

it('uses exponential delays and continues retrying while the request keeps failing', async () => {
  const calls: number[] = [];
  const errors = [429, 503];
  const delays: number[] = [];

  await expect(
    withRetry(
      async () => {
        const status = errors[calls.length];
        if (status === undefined) {
          return 'ok';
        }
        calls.push(status);
        throw makeErrorWithStatus(status);
      },
      {
        retries: 3,
        baseMs: 7,
        sleep: async (ms) => {
          delays.push(ms);
        }
      }
    )
  ).resolves.toBe('ok');

  expect(calls).toEqual([429, 503]);
  expect(delays).toEqual([7, 14]);
});
