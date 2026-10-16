import { isTauri } from '@tauri-apps/api/core';
import type { AIProvider, ProviderId } from './provider-interface';
import { createProvider } from './provider-registry';
import { TauriAiTransport, UnavailableTransport, type AiTransport } from './transport';

let transport: AiTransport | null = null;
let customBaseUrl: string | undefined;

export function setCustomBaseUrl(url: string | undefined): void {
  customBaseUrl = url;
}

export function getTransport(): AiTransport {
  transport ??= isTauri() ? new TauriAiTransport() : new UnavailableTransport();
  return transport;
}

export function setTransportForTesting(t: AiTransport | null): void {
  transport = t;
}

export function getProvider(id: ProviderId): AIProvider {
  return createProvider(id, getTransport(), { baseUrl: customBaseUrl });
}
