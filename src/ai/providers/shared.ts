import { AIError, classifyHttpError } from '../errors';
import type { AiTransport, TransportResponse } from '../transport';
import type { CallOptions } from '../provider-interface';

export function ensureOk(res: TransportResponse): string {
  if (res.status < 200 || res.status >= 300) {
    throw classifyHttpError(res.status, res.body, res.retryAfterSeconds);
  }
  return res.body;
}

export function parseJsonBody(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new AIError('malformed-response', 'provider returned non-JSON content');
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>;
  throw new AIError('malformed-response', 'unexpected response shape');
}

export function modelIds(data: unknown): string[] {
  const list = asRecord(data).data;
  if (!Array.isArray(list)) throw new AIError('malformed-response', 'model list missing');
  const ids = list
    .map((m) => (m && typeof m === 'object' ? (m as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === 'string');
  return [...new Set(ids)].sort();
}

export function callOptions(options?: CallOptions) {
  return { signal: options?.signal, timeoutMs: options?.timeoutMs };
}

export type { AiTransport };
