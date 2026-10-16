export type AIErrorKind =
  | 'missing-key'
  | 'invalid-credentials'
  | 'unsupported-model'
  | 'rate-limit'
  | 'timeout'
  | 'network'
  | 'provider-outage'
  | 'cancelled'
  | 'malformed-response'
  | 'unsupported'
  | 'unknown';

const RETRYABLE: ReadonlySet<AIErrorKind> = new Set(['rate-limit', 'network', 'provider-outage']);

const ACTIONABLE: Record<AIErrorKind, string> = {
  'missing-key': 'No API key is configured. Open Settings and add a key for this provider.',
  'invalid-credentials': 'The provider rejected the API key. Check or replace the key in Settings.',
  'unsupported-model':
    'The selected model is not available for this key. Choose another model in Settings.',
  'rate-limit': 'The provider rate limit was reached. Wait a moment and retry.',
  timeout: 'The provider did not respond in time. Retry, or try a smaller request.',
  network: 'Could not reach the provider. Check your network connection and retry.',
  'provider-outage': 'The provider reported a temporary problem. Retry in a few minutes.',
  cancelled: 'The request was cancelled.',
  'malformed-response':
    'The provider returned a response that could not be used. Retry the request.',
  unsupported: 'This provider does not support the requested capability.',
  unknown: 'The request failed.',
};

// Strip anything that looks like a credential before it reaches logs or the UI.
export function redact(text: string): string {
  return text
    .replace(/\b(sk-[A-Za-z0-9_-]{6,}|sk-ant-[A-Za-z0-9_-]{6,})/g, '[REDACTED]')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]{8,}/gi, '$1[REDACTED]')
    .replace(/(api[-_ ]?key["':=\s]+)[A-Za-z0-9._-]{8,}/gi, '$1[REDACTED]');
}

export class AIError extends Error {
  readonly retryable: boolean;

  constructor(
    readonly kind: AIErrorKind,
    detail?: string,
    readonly options: { status?: number; retryAfterMs?: number } = {},
  ) {
    const safeDetail = detail ? redact(detail).slice(0, 400) : '';
    super(safeDetail ? `${ACTIONABLE[kind]} (${safeDetail})` : ACTIONABLE[kind]);
    this.name = 'AIError';
    this.retryable = RETRYABLE.has(kind);
  }

  get retryAfterMs(): number | undefined {
    return this.options.retryAfterMs;
  }
}

export function isAIError(e: unknown): e is AIError {
  return e instanceof AIError;
}

function providerMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: unknown } | string;
      message?: unknown;
    };
    const err = parsed.error;
    if (typeof err === 'string') return err;
    if (err && typeof err.message === 'string') return err.message;
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    // Non-JSON body (for example a gateway error page): not useful to show.
  }
  return '';
}

export function classifyHttpError(
  status: number,
  body: string,
  retryAfterSeconds?: number,
): AIError {
  const message = providerMessage(body);
  const options = {
    status,
    retryAfterMs: retryAfterSeconds !== undefined ? retryAfterSeconds * 1000 : undefined,
  };
  if (status === 401 || status === 403) return new AIError('invalid-credentials', message, options);
  if (status === 429) return new AIError('rate-limit', message, options);
  if (status === 408 || status === 504) return new AIError('timeout', message, options);
  if (status >= 500) return new AIError('provider-outage', message, options);
  if (status === 404 || (status === 400 && /model/i.test(message))) {
    return new AIError('unsupported-model', message, options);
  }
  return new AIError('unknown', message || `HTTP ${status}`, options);
}

const BACKEND_KINDS: ReadonlySet<string> = new Set([
  'missing-key',
  'invalid-credentials',
  'timeout',
  'network',
  'cancelled',
  'malformed-response',
]);

// Errors rejected by the Rust `ai_http_request` command have the shape { kind, message }.
export function fromBackendError(e: unknown): AIError {
  if (isAIError(e)) return e;
  if (e && typeof e === 'object' && 'kind' in e) {
    const { kind, message } = e as { kind: string; message?: string };
    if (BACKEND_KINDS.has(kind))
      return new AIError(kind as AIErrorKind, kind === 'cancelled' ? undefined : message);
    return new AIError('unknown', message);
  }
  return new AIError('unknown', typeof e === 'string' ? e : undefined);
}
