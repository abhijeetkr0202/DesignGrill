import { SCHEMA_VERSION, SessionDocumentSchema, SessionExtraSchema } from '@/types/session';
import type { SessionDocument, SessionMeta } from '@/types/session';

export class StorageError extends Error {
  constructor(
    message: string,
    readonly kind: string = 'storage',
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export interface ProblemInfo {
  id: string;
  version: number;
  title: string;
  contentHash?: string;
}

export interface SessionRepository {
  list(): Promise<SessionMeta[]>;
  load(id: string): Promise<SessionDocument>;
  save(doc: SessionDocument): Promise<void>;
  delete(id: string): Promise<void>;
  upsertProblem(info: ProblemInfo): Promise<void>;
}

export interface PreferenceRepository {
  list(): Promise<Record<string, string>>;
  set(key: string, value: string | null): Promise<void>;
}

// Wire format shared with the Rust `SessionRecord`.
export interface SessionRecord {
  meta: SessionMeta & { extra: Record<string, unknown> };
  architecture: unknown;
  requirements: unknown[];
  decisions: unknown[];
  messages: unknown[];
  reviews: unknown[];
  findings: unknown[];
  summaries: unknown[];
}

export function toRecord(doc: SessionDocument): SessionRecord {
  return {
    meta: {
      id: doc.id,
      problemId: doc.problemId,
      problemVersion: doc.problemVersion,
      title: doc.title,
      status: doc.status,
      schemaVersion: doc.schemaVersion,
      revision: doc.revision,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      extra: {
        pendingQuestion: doc.pendingQuestion,
        reviewBaseline: doc.reviewBaseline,
        problemStatement: doc.problemStatement,
      },
    },
    architecture: doc.architecture,
    requirements: doc.requirements,
    decisions: doc.decisions,
    messages: doc.messages,
    reviews: doc.reviews,
    findings: doc.findings,
    summaries: doc.summaries,
  };
}

export function fromRecord(record: SessionRecord): SessionDocument {
  if (record.meta.schemaVersion > SCHEMA_VERSION) {
    throw new StorageError(
      `This session was saved by a newer version of DesignGrill (schema ${record.meta.schemaVersion}).`,
      'invalid',
    );
  }
  const extra = SessionExtraSchema.safeParse(record.meta.extra ?? {});
  const { extra: _extra, ...meta } = record.meta;
  const parsed = SessionDocumentSchema.safeParse({
    ...meta,
    architecture: record.architecture,
    requirements: record.requirements,
    decisions: record.decisions,
    messages: record.messages,
    reviews: record.reviews,
    findings: record.findings,
    summaries: record.summaries,
    pendingQuestion: extra.success ? extra.data.pendingQuestion : null,
    reviewBaseline: extra.success ? extra.data.reviewBaseline : null,
    problemStatement: extra.success ? extra.data.problemStatement : '',
  });
  if (!parsed.success) {
    throw new StorageError(
      `Session data is invalid and could not be loaded: ${parsed.error.issues[0]?.path.join('.') ?? 'unknown'}`,
      'invalid',
    );
  }
  return parsed.data;
}
