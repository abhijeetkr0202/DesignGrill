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

export interface OpenAICompatConfig {
  id: 'openai' | 'custom';
  displayName: string;
  // Required for the custom provider; the built-in one has a fixed host.
  baseUrl?: string;
}

// Uses the Chat Completions endpoint, which is accepted across OpenAI model families
// and by most OpenAI-compatible servers (OpenRouter, Groq, Together, Ollama, LM Studio).
export class OpenAIProvider implements AIProvider {
  readonly id: 'openai' | 'custom';
  readonly displayName: string;
  readonly capabilities: { streaming: boolean; nativeJsonMode: boolean };
  private readonly baseUrl?: string;

  constructor(
    private readonly transport: AiTransport,
    config: OpenAICompatConfig = { id: 'openai', displayName: 'OpenAI' },
  ) {
    this.id = config.id;
    this.displayName = config.displayName;
    this.baseUrl = config.baseUrl;
    this.capabilities = { streaming: false, nativeJsonMode: config.id === 'openai' };
  }

  private target(): { provider: 'openai' | 'custom'; baseUrl?: string } {
    if (this.id === 'custom') {
      if (!this.baseUrl) throw new AIError('invalid-endpoint');
      return { provider: 'custom', baseUrl: this.baseUrl };
    }
    return { provider: 'openai' };
  }

  async testConnection(options?: CallOptions): Promise<void> {
    await this.listModels(options);
  }

  async listModels(options?: CallOptions): Promise<string[]> {
    const res = await this.transport.send({
      ...this.target(),
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
    };
    // Compatible servers generally accept max_tokens but not always max_completion_tokens.
    if (this.id === 'custom') body.max_tokens = request.maxOutputTokens;
    else body.max_completion_tokens = request.maxOutputTokens;
    // JSON mode is not universal among compatible servers; the prompt asks for JSON anyway.
    if (request.json && this.id === 'openai') body.response_format = { type: 'json_object' };

    const res = await this.transport.send({
      ...this.target(),
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
