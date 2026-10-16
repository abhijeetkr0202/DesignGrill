import { AIError, isAIError } from './errors';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AIError('cancelled'));
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AIError('cancelled'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// Only transient failures are retried, and only a small bounded number of times.
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, maxDelayMs = 20_000, signal } = options;
  const wait = options.sleep ?? sleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isAIError(e) || !e.retryable || attempt >= maxAttempts || signal?.aborted) throw e;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jittered = backoff / 2 + Math.random() * (backoff / 2);
      await wait(Math.min(maxDelayMs, e.retryAfterMs ?? jittered), signal);
    }
  }
}
