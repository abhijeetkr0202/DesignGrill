import { create } from 'zustand';
import { AIError, isAIError } from '@/ai/errors';
import type { ProviderId } from '@/ai/provider-interface';
import { PROVIDER_IDS, PROVIDER_INFO, isProviderId } from '@/ai/provider-registry';
import { getProvider } from '@/ai/runtime';
import { getRepositories } from '@/data/repositories';
import { deleteApiKey, hasApiKey, saveApiKey } from './credentials';
import { useUiStore, type Theme } from '@/store/ui-store';

export type ConnectionStatus =
  'unknown' | 'no-key' | 'key-saved' | 'testing' | 'connected' | 'failed';

interface ProviderState {
  status: ConnectionStatus;
  error: string | null;
  availableModels: string[];
}

interface SettingsState {
  loaded: boolean;
  provider: ProviderId;
  models: Record<ProviderId, string>;
  providers: Record<ProviderId, ProviderState>;
  load(): Promise<void>;
  setProvider(id: ProviderId): Promise<void>;
  setModel(id: ProviderId, model: string): Promise<void>;
  setTheme(theme: Theme): Promise<void>;
  saveKey(id: ProviderId, key: string): Promise<void>;
  removeKey(id: ProviderId): Promise<void>;
  testConnection(id: ProviderId): Promise<void>;
}

const blank = (): ProviderState => ({ status: 'unknown', error: null, availableModels: [] });

const defaultModels = (): Record<ProviderId, string> => ({
  openai: PROVIDER_INFO.openai.defaultModel,
  anthropic: PROVIDER_INFO.anthropic.defaultModel,
});

export const useSettingsStore = create<SettingsState>((set, get) => {
  const patchProvider = (id: ProviderId, patch: Partial<ProviderState>) =>
    set((s) => ({ providers: { ...s.providers, [id]: { ...s.providers[id], ...patch } } }));

  const pref = (key: string, value: string | null) => getRepositories().preferences.set(key, value);

  return {
    loaded: false,
    provider: 'openai',
    models: defaultModels(),
    providers: { openai: blank(), anthropic: blank() },

    async load() {
      const values = await getRepositories()
        .preferences.list()
        .catch(() => ({}) as Record<string, string>);
      const models = defaultModels();
      for (const id of PROVIDER_IDS) {
        const saved = values[`ai.model.${id}`];
        if (saved) models[id] = saved;
      }
      const provider = isProviderId(values['ai.provider']) ? values['ai.provider'] : 'openai';
      if (values.theme === 'light' || values.theme === 'dark')
        useUiStore.getState().setTheme(values.theme);
      set({ loaded: true, provider, models });
      for (const id of PROVIDER_IDS) {
        const present = await hasApiKey(id).catch(() => false);
        patchProvider(id, { status: present ? 'key-saved' : 'no-key' });
      }
    },

    async setProvider(id) {
      set({ provider: id });
      await pref('ai.provider', id).catch(() => undefined);
    },

    async setModel(id, model) {
      const trimmed = model.trim();
      if (!trimmed) return;
      set((s) => ({ models: { ...s.models, [id]: trimmed } }));
      await pref(`ai.model.${id}`, trimmed).catch(() => undefined);
    },

    async setTheme(theme) {
      useUiStore.getState().setTheme(theme);
      await pref('theme', theme).catch(() => undefined);
    },

    async saveKey(id, key) {
      try {
        await saveApiKey(id, key);
        patchProvider(id, { status: 'key-saved', error: null, availableModels: [] });
      } catch (e) {
        patchProvider(id, { error: e instanceof Error ? e.message : 'Could not save the key' });
        throw e;
      }
    },

    async removeKey(id) {
      await deleteApiKey(id);
      patchProvider(id, { status: 'no-key', error: null, availableModels: [] });
    },

    async testConnection(id) {
      patchProvider(id, { status: 'testing', error: null });
      try {
        const provider = getProvider(id);
        await provider.testConnection({ timeoutMs: 20_000 });
        // Model listing is a convenience; a failure here should not fail the connection test.
        const availableModels: string[] = await provider
          .listModels({ timeoutMs: 20_000 })
          .catch((): string[] => []);
        patchProvider(id, { status: 'connected', error: null, availableModels });
        const current = get().models[id];
        if (availableModels.length > 0 && !availableModels.includes(current)) {
          patchProvider(id, {
            error: `Model "${current}" is not listed for this key. Choose one of the available models.`,
          });
        }
      } catch (e) {
        const err = isAIError(e) ? e : new AIError('unknown');
        const stored = await hasApiKey(id).catch(() => false);
        patchProvider(id, {
          status: err.kind === 'missing-key' || !stored ? 'no-key' : 'failed',
          error: err.message,
        });
      }
    },
  };
});
