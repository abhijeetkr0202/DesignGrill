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

// Uses the Chat Completions endpoint, which is accepted across OpenAI model families.
export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const;
  readonly displayName = 'OpenAI';
  readonly capabilities = { streaming: false, nativeJsonMode: true };

  constructor(private readonly transport: AiTransport) {}

  async testConnection(options?: CallOptions): Promise<void> {
    await this.listModels(options);
  }

  async listModels(options?: CallOptions): Promise<string[]> {
    const res = await this.transport.send({
      provider: 'openai',
      method: 'GET',
      path: '/v1/models',
      ...callOptions(options),
    });
    return modelIds(parseJsonBody(ensureOk(res)));
  }

  async complete(request: CompletionRequest, options?: CallOptions): Promise<CompletionResult> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: [{ role: 'system', content: request.system }, ...request.messages],
      max_completion_tokens: request.maxOutputTokens,
    };
    if (request.json) body.response_format = { type: 'json_object' };

    const res = await this.transport.send({
      provider: 'openai',
      method: 'POST',
      path: '/v1/chat/completions',
      body,
      ...callOptions(options),
    });
    const data = asRecord(parseJsonBody(ensureOk(res)));
    const choices = data.choices;
    const first = Array.isArray(choices) ? asRecord(choices[0]) : undefined;
    const content = first ? asRecord(first.message).content : undefined;
    if (typeof content !== 'string' || content.length === 0) {
      throw new AIError('malformed-response', 'no message content in response');
    }
    return {
      text: content,
      model: typeof data.model === 'string' ? data.model : request.model,
      truncated: first?.finish_reason === 'length',
    };
  }
}
