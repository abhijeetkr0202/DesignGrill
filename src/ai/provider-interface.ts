export type ProviderId = 'openai' | 'anthropic' | 'openrouter' | 'custom';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  // Ask the provider to produce a single JSON object where it has a native mode.
  json?: boolean;
}

export interface CompletionResult {
  text: string;
  model: string;
  // True when output stopped because of the token limit, so JSON may be cut off.
  truncated: boolean;
}

export interface CallOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly capabilities: {
    streaming: boolean;
    nativeJsonMode: boolean;
  };
  testConnection(options?: CallOptions): Promise<void>;
  listModels(options?: CallOptions): Promise<string[]>;
  complete(request: CompletionRequest, options?: CallOptions): Promise<CompletionResult>;
}
