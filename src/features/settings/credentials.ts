import { invoke, isTauri } from '@tauri-apps/api/core';
import { AIError } from '@/ai/errors';
import type { ProviderId } from '@/ai/provider-interface';
import { StorageError } from '@/data/repositories';

function toError(e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) {
    return new StorageError((e as { message: string }).message, (e as { kind?: string }).kind);
  }
  return new Error('Credential store request failed');
}

function requireDesktop(): void {
  if (!isTauri()) {
    throw new AIError('unsupported', 'API keys can only be stored in the desktop app');
  }
}

// Keys are written once and never read back into the UI.
export async function saveApiKey(provider: ProviderId, key: string): Promise<void> {
  requireDesktop();
  try {
    await invoke('credential_set', { provider, key });
  } catch (e) {
    throw toError(e);
  }
}

export async function hasApiKey(provider: ProviderId): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await invoke<boolean>('credential_status', { provider });
  } catch (e) {
    throw toError(e);
  }
}

export async function deleteApiKey(provider: ProviderId): Promise<void> {
  requireDesktop();
  try {
    await invoke('credential_delete', { provider });
  } catch (e) {
    throw toError(e);
  }
}
