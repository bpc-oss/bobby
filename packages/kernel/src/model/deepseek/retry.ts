export interface RetryOptions {
  retries: number;
  baseMs: number;
  sleep?: (ms: number) => Promise<void>;
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND']);

type ErrorLike = {
  message?: unknown;
  status?: unknown;
  code?: unknown;
  cause?: unknown;
  errno?: unknown;
};

function readStringField(value: unknown, field: 'code' | 'errno' | 'message'): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const raw = (value as Record<string, unknown>)[field];
  return typeof raw === 'string' ? raw : undefined;
}

function getStatus(error: unknown): number | undefined {
  if (error instanceof Error) {
    const raw = (error as { status?: unknown }).status;
    return typeof raw === 'number' ? raw : undefined;
  }
  return undefined;
}

function isFetchFailedError(error: unknown): boolean {
  return error instanceof TypeError && error.message === 'fetch failed';
}

function getRetryableCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const code = readStringField(error, 'code');
  if (code) {
    return code;
  }

  const errno = readStringField(error, 'errno');
  if (errno) {
    return errno;
  }

  return getRetryableCode((error as ErrorLike).cause);
}

function shouldRetryNetworkError(error: unknown): boolean {
  if (!isFetchFailedError(error) && !(error instanceof Error)) {
    return false;
  }

  const code = getRetryableCode(error as ErrorLike);
  return code !== undefined && RETRYABLE_NETWORK_CODES.has(code);
}

function shouldRetry(error: unknown): boolean {
  const status = getStatus(error);
  return (
    (status !== undefined && RETRYABLE_STATUSES.has(status)) ||
    isFetchFailedError(error) ||
    shouldRetryNetworkError(error)
  );
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
