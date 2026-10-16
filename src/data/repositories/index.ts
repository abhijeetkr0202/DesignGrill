import { isTauri } from '@tauri-apps/api/core';
import { MemoryPreferenceRepository, MemorySessionRepository } from './memory-repository';
import { TauriPreferenceRepository, TauriSessionRepository } from './tauri-repository';
import type { PreferenceRepository, SessionRepository } from './types';

export interface Repositories {
  sessions: SessionRepository;
  preferences: PreferenceRepository;
  // False when running outside the desktop shell: data is not persisted across reloads.
  durable: boolean;
}

let current: Repositories | null = null;

export function getRepositories(): Repositories {
  if (!current) {
    current = isTauri()
      ? {
          sessions: new TauriSessionRepository(),
          preferences: new TauriPreferenceRepository(),
          durable: true,
        }
      : {
          sessions: new MemorySessionRepository(),
          preferences: new MemoryPreferenceRepository(),
          durable: false,
        };
  }
  return current;
}

export function setRepositoriesForTesting(repos: Repositories | null): void {
  current = repos;
}

export * from './types';
