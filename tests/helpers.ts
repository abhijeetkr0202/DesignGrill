import type {
  AIProvider,
  CallOptions,
  CompletionRequest,
  CompletionResult,
} from '@/ai/provider-interface';
import type { AiTransport, TransportRequest, TransportResponse } from '@/ai/transport';
import { createSession } from '@/features/interview-session/commands';
import { loadProblemPack } from '@/features/problem-library/loader';
import type { SessionDocument } from '@/types/session';
import type { Context } from '@/utils/context';

export function makeCtx(): Context {
  let n = 0;
  let t = Date.parse('2026-01-01T00:00:00Z');
  return {
    now: () => new Date((t += 1000)).toISOString(),
    newId: (prefix) => `${prefix}_${++n}`,
  };
}

export function newDoc(ctx: Context = makeCtx()): SessionDocument {
  return createSession(
    { problemId: 'url-shortener', problemVersion: 1, title: 'URL Shortener' },
    ctx,
  );
}

export const loadPack = () => loadProblemPack('url-shortener');

export class FakeProvider implements AIProvider {
  readonly id = 'openai' as const;
  readonly displayName = 'Fake';
  readonly capabilities = { streaming: false, nativeJsonMode: true };
  readonly requests: CompletionRequest[] = [];
  constructor(private readonly replies: (string | Error)[]) {}

  async testConnection(): Promise<void> {}
  async listModels(): Promise<string[]> {
    return ['fake-model'];
  }
  async complete(request: CompletionRequest, options?: CallOptions): Promise<CompletionResult> {
    this.requests.push(request);
    if (options?.signal?.aborted) throw new Error('aborted');
    const next = this.replies.shift();
    if (next === undefined) throw new Error('FakeProvider: no reply queued');
    if (next instanceof Error) throw next;
    return { text: next, model: 'fake-model', truncated: false };
  }
}

export class FakeTransport implements AiTransport {
  readonly sent: TransportRequest[] = [];
  constructor(private readonly responses: (TransportResponse | Error)[]) {}
  async send(request: TransportRequest): Promise<TransportResponse> {
    this.sent.push(request);
    const next = this.responses.shift();
    if (!next) throw new Error('FakeTransport: no response queued');
    if (next instanceof Error) throw next;
    return next;
  }
}
