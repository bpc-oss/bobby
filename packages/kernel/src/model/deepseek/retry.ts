export interface RetryOptions {
  retries: number;
  baseMs: number;
  sleep?: (ms: number) => Promise<void>;
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function getStatus(error: unknown): number | undefined {
  if (error instanceof Error) {
    const raw = (error as { status?: unknown }).status;
    return typeof raw === 'number' ? raw : undefined;
  }
  return undefined;
}

function shouldRetry(error: unknown): boolean {
  const status = getStatus(error);
  return status !== undefined && RETRYABLE_STATUSES.has(status);
}

const sleepDefault = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { retries, baseMs } = options;
  const sleep = options.sleep ?? sleepDefault;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!shouldRetry(error) || attempt >= retries) {
        throw error;
      }

      const delayMs = baseMs * 2 ** attempt;
      await sleep(delayMs);
    }
  }

  throw new Error(`Exhausted retries (${retries}) for request`);
}
