import { create } from 'zustand';
import { getProvider } from '@/ai/runtime';
import { hasApiKey } from '@/features/settings/credentials';
import { useSettingsStore } from '@/features/settings/settings-store';
import { useSessionStore } from '@/store/session-store';
import {
  createInterviewService,
  type AiRequestState,
  type InterviewService,
} from './interview-service';

interface AiStore {
  state: AiRequestState;
  set(state: AiRequestState): void;
}

export const useAiStore = create<AiStore>((set) => ({
  state: { status: 'idle' },
  set: (state) => set({ state }),
}));

let service: InterviewService | null = null;

export function getInterviewService(): InterviewService {
  service ??= createInterviewService({
    getDoc: () => useSessionStore.getState().doc,
    getPack: () => useSessionStore.getState().pack,
    update: (mutator) => useSessionStore.getState().apply(mutator, { history: false }),
    getSettings: () => {
      const { provider, models, progressive } = useSettingsStore.getState();
      return { provider, model: models[provider], progressive };
    },
    getProvider,
    hasKey: hasApiKey,
    onState: (state) => useAiStore.getState().set(state),
  });
  return service;
}
