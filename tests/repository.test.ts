import { describe, expect, it } from 'vitest';
import { MemorySessionRepository } from '@/data/repositories/memory-repository';
import { StorageError, fromRecord, toRecord } from '@/data/repositories/types';
import {
  addComponent,
  addRequirement,
  appendMessage,
  connectComponents,
  recordDecision,
  setPendingQuestion,
} from '@/features/interview-session/commands';
import { takeBaseline } from '@/features/design-review/changes';
import { makeCtx, newDoc } from './helpers';

function richDoc() {
  const ctx = makeCtx();
  let doc = newDoc(ctx);
  const a = addComponent(doc, { type: 'service', label: 'API', position: { x: 1, y: 2 } }, ctx);
  const b = addComponent(a.doc, { type: 'database', position: { x: 3, y: 4 } }, ctx);
  doc = connectComponents(
    b.doc,
    { source: a.id, target: b.id, label: 'SQL', mode: 'sync' },
    ctx,
  ).doc;
  doc = addRequirement(
    doc,
    { kind: 'nonFunctional', title: 'Latency', target: 'p99 < 100ms' },
    ctx,
  ).doc;
  doc = recordDecision(doc, { title: 'Use Postgres', relatedNodeIds: [b.id] }, ctx).doc;
  doc = appendMessage(doc, { role: 'candidate', content: 'hello' }, ctx);
  doc = setPendingQuestion(
    doc,
    {
      id: 'q1',
      text: 'Why?',
      mode: 'architecture-interview',
      askedAt: ctx.now(),
      basedOnRevision: doc.revision,
    },
    ctx,
  );
  return { ...doc, reviewBaseline: takeBaseline(doc, ctx.now()) };
}

describe('session record mapping', () => {
  it('round-trips a full session through the wire format and JSON', () => {
    const doc = richDoc();
    const wire = JSON.parse(JSON.stringify(toRecord(doc)));
    expect(fromRecord(wire)).toEqual(doc);
  });

  it('rejects corrupt section data with a clear error instead of loading partial state', () => {
    const wire = JSON.parse(JSON.stringify(toRecord(richDoc())));
    wire.requirements[0].kind = 'bogus';
    expect(() => fromRecord(wire)).toThrow(StorageError);
  });

  it('refuses sessions written by a newer schema', () => {
    const wire = JSON.parse(JSON.stringify(toRecord(richDoc())));
    wire.meta.schemaVersion = 99;
    expect(() => fromRecord(wire)).toThrow(/newer version/);
  });

  it('tolerates missing extra metadata', () => {
    const wire = JSON.parse(JSON.stringify(toRecord(richDoc())));
    delete wire.meta.extra;
    const doc = fromRecord(wire);
    expect(doc.pendingQuestion).toBeNull();
    expect(doc.reviewBaseline).toBeNull();
  });
});

describe('MemorySessionRepository', () => {
  it('saves, lists, loads and deletes without sharing mutable state', async () => {
    const repo = new MemorySessionRepository();
    const doc = richDoc();
    await repo.save(doc);
    const loaded = await repo.load(doc.id);
    expect(loaded).toEqual(doc);
    expect(loaded).not.toBe(doc);
    expect((await repo.list()).map((s) => s.id)).toEqual([doc.id]);
    await repo.delete(doc.id);
    await expect(repo.load(doc.id)).rejects.toThrow(StorageError);
  });
});
