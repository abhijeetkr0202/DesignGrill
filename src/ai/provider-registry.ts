import type { AIProvider, ProviderId } from './provider-interface';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';
import type { AiTransport } from './transport';

export interface ProviderInfo {
  id: ProviderId;
  displayName: string;
  // Suggested starting points. Model names change; the settings screen lists what the key can use.
  defaultModel: string;
  consoleUrl: string;
}

export const PROVIDER_INFO: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: 'openai',
    displayName: 'OpenAI',
    defaultModel: 'gpt-4.1',
    consoleUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic',
    displayName: 'Anthropic',
    defaultModel: 'claude-sonnet-4-5',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDER_INFO) as ProviderId[];

export function isProviderId(value: string | undefined): value is ProviderId {
  return value !== undefined && value in PROVIDER_INFO;
}

export function createProvider(id: ProviderId, transport: AiTransport): AIProvider {
  switch (id) {
    case 'openai':
      return new OpenAIProvider(transport);
    case 'anthropic':
      return new AnthropicProvider(transport);
  }
}
