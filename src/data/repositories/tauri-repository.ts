import { invoke } from '@tauri-apps/api/core';
import { SessionMetaSchema } from '@/types/session';
import type { SessionDocument, SessionMeta } from '@/types/session';
import {
  StorageError,
  fromRecord,
  toRecord,
  type PreferenceRepository,
  type ProblemInfo,
  type SessionRecord,
  type SessionRepository,
} from './types';

function toStorageError(e: unknown): StorageError {
  if (e instanceof StorageError) return e;
  if (e && typeof e === 'object' && 'message' in e) {
    const { kind, message } = e as { kind?: string; message: string };
    return new StorageError(message, kind ?? 'storage');
  }
  return new StorageError(typeof e === 'string' ? e : 'Unknown storage error');
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (e) {
    throw toStorageError(e);
  }
}

export class TauriSessionRepository implements SessionRepository {
  async list(): Promise<SessionMeta[]> {
    const rows = await call<unknown[]>('session_list');
    const out: SessionMeta[] = [];
    for (const row of rows) {
      const parsed = SessionMetaSchema.safeParse(row);
      if (parsed.success) out.push(parsed.data);
    }
    return out;
  }

  async load(id: string): Promise<SessionDocument> {
    return fromRecord(await call<SessionRecord>('session_load', { id }));
  }

  async save(doc: SessionDocument): Promise<void> {
    await call<void>('session_save', { record: toRecord(doc) });
  }

  async delete(id: string): Promise<void> {
    await call<boolean>('session_delete', { id });
  }

  async upsertProblem(info: ProblemInfo): Promise<void> {
    await call<void>('problem_upsert', {
      id: info.id,
      version: info.version,
      title: info.title,
      contentHash: info.contentHash ?? null,
      updatedAt: new Date().toISOString(),
    });
  }
}

export class TauriPreferenceRepository implements PreferenceRepository {
  async list(): Promise<Record<string, string>> {
    const rows = await call<[string, string][]>('preference_list');
    return Object.fromEntries(rows);
  }

  async set(key: string, value: string | null): Promise<void> {
    await call<void>('preference_set', { key, value });
  }
}
