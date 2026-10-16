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

// Used in tests and when running the UI in a plain browser (npm run dev) without the desktop shell.
export class MemorySessionRepository implements SessionRepository {
  private readonly records = new Map<string, SessionRecord>();
  readonly problems = new Map<string, ProblemInfo>();
  failNextSave: Error | null = null;

  async list(): Promise<SessionMeta[]> {
    return [...this.records.values()]
      .map((r) => fromRecord(r))
      .map(
        ({
          id,
          problemId,
          problemVersion,
          title,
          status,
          schemaVersion,
          revision,
          createdAt,
          updatedAt,
        }) => ({
          id,
          problemId,
          problemVersion,
          title,
          status,
          schemaVersion,
          revision,
          createdAt,
          updatedAt,
        }),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async load(id: string): Promise<SessionDocument> {
    const record = this.records.get(id);
    if (!record) throw new StorageError(`not found: session ${id}`, 'not-found');
    return fromRecord(structuredClone(record));
  }

  async save(doc: SessionDocument): Promise<void> {
    if (this.failNextSave) {
      const e = this.failNextSave;
      this.failNextSave = null;
      throw e;
    }
    this.records.set(doc.id, structuredClone(toRecord(doc)));
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }

  async upsertProblem(info: ProblemInfo): Promise<void> {
    this.problems.set(info.id, info);
  }
}

export class MemoryPreferenceRepository implements PreferenceRepository {
  private readonly values = new Map<string, string>();

  async list(): Promise<Record<string, string>> {
    return Object.fromEntries(this.values);
  }

  async set(key: string, value: string | null): Promise<void> {
    if (value === null) this.values.delete(key);
    else this.values.set(key, value);
  }
}
