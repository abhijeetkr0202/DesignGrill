import { invoke } from '@tauri-apps/api/core';
import { AIError, fromBackendError } from './errors';
import type { ProviderId } from './provider-interface';

export interface TransportRequest {
  provider: ProviderId;
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface TransportResponse {
  status: number;
  body: string;
  retryAfterSeconds?: number;
}

// Providers talk to this interface only; the real implementation keeps API keys in the native layer.
export interface AiTransport {
  send(request: TransportRequest): Promise<TransportResponse>;
}

interface BackendResponse {
  status: number;
  body: string;
  retryAfterSeconds: number | null;
}

export class TauriAiTransport implements AiTransport {
  async send(req: TransportRequest): Promise<TransportResponse> {
    if (req.signal?.aborted) throw new AIError('cancelled');
    const requestId = crypto.randomUUID();
    const onAbort = () => {
      void invoke('ai_cancel', { requestId }).catch(() => undefined);
    };
    req.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const res = await invoke<BackendResponse>('ai_http_request', {
        request: {
          provider: req.provider,
          method: req.method,
          path: req.path,
          body: req.body === undefined ? null : JSON.stringify(req.body),
          requestId,
          timeoutMs: req.timeoutMs ?? null,
        },
      });
      return {
        status: res.status,
        body: res.body,
        retryAfterSeconds: res.retryAfterSeconds ?? undefined,
      };
    } catch (e) {
      throw fromBackendError(e);
    } finally {
      req.signal?.removeEventListener('abort', onAbort);
    }
  }
}

// Used when running outside the desktop shell, where no secure key storage or native HTTP exists.
export class UnavailableTransport implements AiTransport {
  async send(): Promise<TransportResponse> {
    throw new AIError(
      'unsupported',
      'AI features require the DesignGrill desktop app, which stores API keys in the OS credential store',
    );
  }
}
