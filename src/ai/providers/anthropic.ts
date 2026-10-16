import { AIError } from '../errors';
import type {
  AIProvider,
  CallOptions,
  CompletionRequest,
  CompletionResult,
} from '../provider-interface';
import {
  asRecord,
  callOptions,
  ensureOk,
  modelIds,
  parseJsonBody,
  type AiTransport,
} from './shared';

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic' as const;
  readonly displayName = 'Anthropic';
  // The Messages API has no JSON mode; structure is requested in the prompt and validated locally.
  readonly capabilities = { streaming: false, nativeJsonMode: false };

  constructor(private readonly transport: AiTransport) {}

  async testConnection(options?: CallOptions): Promise<void> {
    await this.listModels(options);
  }

  async listModels(options?: CallOptions): Promise<string[]> {
    const res = await this.transport.send({
      provider: 'anthropic',
      method: 'GET',
      path: '/v1/models?limit=100',
      ...callOptions(options),
    });
    return modelIds(parseJsonBody(ensureOk(res)));
  }

  async complete(request: CompletionRequest, options?: CallOptions): Promise<CompletionResult> {
    const res = await this.transport.send({
      provider: 'anthropic',
      method: 'POST',
      path: '/v1/messages',
      body: {
        model: request.model,
        system: request.system,
        messages: request.messages,
        max_tokens: request.maxOutputTokens,
      },
      ...callOptions(options),
    });
    const data = asRecord(parseJsonBody(ensureOk(res)));
    const blocks = data.content;
    if (!Array.isArray(blocks))
      throw new AIError('malformed-response', 'no content blocks in response');
    const text = blocks
      .map((b) => (b && typeof b === 'object' ? (b as { type?: unknown; text?: unknown }) : {}))
      .filter(
        (b): b is { type: 'text'; text: string } => b.type === 'text' && typeof b.text === 'string',
      )
      .map((b) => b.text)
      .join('');
    if (!text) throw new AIError('malformed-response', 'response contained no text');
    return {
      text,
      model: typeof data.model === 'string' ? data.model : request.model,
      truncated: data.stop_reason === 'max_tokens',
    };
  }
}
