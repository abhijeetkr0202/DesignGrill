import { describe, expect, it } from 'vitest';
import { computeChanges, takeBaseline } from '@/features/design-review/changes';
import {
  addComponent,
  addRequirement,
  connectComponents,
  moveComponents,
  recordDecision,
  removeComponents,
  removeDecision,
  removeRequirement,
  updateComponent,
  updateDecision,
  updateRequirement,
  setReviewBaseline,
} from '@/features/interview-session/commands';
import { makeCtx, newDoc } from './helpers';

describe('requirements', () => {
  it('adds, edits and removes requirements', () => {
    const ctx = makeCtx();
    let doc = newDoc(ctx);
    const added = addRequirement(
      doc,
      { kind: 'nonFunctional', title: 'Latency', category: 'latency' },
      ctx,
    );
    doc = added.doc;
    expect(doc.requirements).toHaveLength(1);
    expect(doc.requirements[0]?.status).toBe('unresolved');

    doc = updateRequirement(doc, added.id, { target: 'p99 < 100 ms', status: 'confirmed' }, ctx);
    expect(doc.requirements[0]).toMatchObject({ target: 'p99 < 100 ms', status: 'confirmed' });

    doc = removeRequirement(doc, added.id, ctx);
    expect(doc.requirements).toHaveLength(0);
  });

  it('flags linked decisions for re-evaluation when a requirement changes meaningfully', () => {
    const ctx = makeCtx();
    let doc = newDoc(ctx);
    const req = addRequirement(
      doc,
      { kind: 'nonFunctional', title: 'Availability', target: '99.9%' },
      ctx,
    );
    doc = req.doc;
    const dec = recordDecision(
      doc,
      { title: 'Use replicas', relatedRequirementIds: [req.id] },
      ctx,
    );
    doc = dec.doc;

    doc = updateRequirement(doc, req.id, { notes: 'just a note' }, ctx);
    expect(doc.decisions[0]?.status).toBe('active');

    doc = updateRequirement(doc, req.id, { target: '99.99%' }, ctx);
    expect(doc.decisions[0]).toMatchObject({ status: 'needs-reevaluation' });
    expect(doc.decisions[0]?.reevaluationReason).toContain('Availability');

    doc = updateDecision(doc, dec.id, { status: 'active' }, ctx);
    expect(doc.decisions[0]?.reevaluationReason).toBeUndefined();
  });

  it('removing a requirement unlinks it and flags decisions', () => {
    const ctx = makeCtx();
    let doc = newDoc(ctx);
    const req = addRequirement(doc, { kind: 'functional', title: 'Redirect' }, ctx);
    const dec = recordDecision(req.doc, { title: 'Cache', relatedRequirementIds: [req.id] }, ctx);
    doc = removeRequirement(dec.doc, req.id, ctx);
    expect(doc.decisions[0]?.relatedRequirementIds).toEqual([]);
    expect(doc.decisions[0]?.status).toBe('needs-reevaluation');
  });
});

describe('architecture', () => {
  it('adds components with default labels and keeps ids stable', () => {
    const ctx = makeCtx();
    const a = addComponent(newDoc(ctx), { type: 'cache', position: { x: 1, y: 2 } }, ctx);
    expect(a.doc.architecture.nodes[0]).toMatchObject({ id: a.id, label: 'Cache', type: 'cache' });
  });

  it('connects components but rejects self loops, unknown nodes and duplicates', () => {
    const ctx = makeCtx();
    const a = addComponent(newDoc(ctx), { type: 'service', position: { x: 0, y: 0 } }, ctx);
    const b = addComponent(a.doc, { type: 'database', position: { x: 100, y: 0 } }, ctx);
    const ok = connectComponents(b.doc, { source: a.id, target: b.id, label: 'reads' }, ctx);
    expect(ok.id).not.toBeNull();
    expect(connectComponents(ok.doc, { source: a.id, target: a.id }, ctx).id).toBeNull();
    expect(connectComponents(ok.doc, { source: a.id, target: 'ghost' }, ctx).id).toBeNull();
    expect(
      connectComponents(ok.doc, { source: a.id, target: b.id, label: 'reads' }, ctx).id,
    ).toBeNull();
    expect(connectComponents(ok.doc, { source: b.id, target: a.id }, ctx).id).not.toBeNull();
  });

  it('removing components cascades to edges and decision links', () => {
    const ctx = makeCtx();
    const a = addComponent(newDoc(ctx), { type: 'service', position: { x: 0, y: 0 } }, ctx);
    const b = addComponent(a.doc, { type: 'database', position: { x: 100, y: 0 } }, ctx);
    const e = connectComponents(b.doc, { source: a.id, target: b.id }, ctx);
    const d = recordDecision(e.doc, { title: 'DB choice', relatedNodeIds: [b.id] }, ctx);
    const doc = removeComponents(d.doc, [b.id], ctx);
    expect(doc.architecture.nodes.map((n) => n.id)).toEqual([a.id]);
    expect(doc.architecture.edges).toHaveLength(0);
    expect(doc.decisions[0]?.relatedNodeIds).toEqual([]);
    expect(doc.decisions[0]?.status).toBe('needs-reevaluation');
  });

  it('moves do not bump the semantic revision but edits do', () => {
    const ctx = makeCtx();
    const a = addComponent(newDoc(ctx), { type: 'service', position: { x: 0, y: 0 } }, ctx);
    const moved = moveComponents(a.doc, { [a.id]: { x: 50, y: 50 } }, ctx);
    expect(moved.revision).toBe(a.doc.revision);
    expect(moved.architecture.nodes[0]?.position).toEqual({ x: 50, y: 50 });
    expect(moveComponents(moved, { [a.id]: { x: 50, y: 50 } }, ctx)).toBe(moved);
    const edited = updateComponent(moved, a.id, { responsibility: 'Resolve codes' }, ctx);
    expect(edited.revision).toBe(moved.revision + 1);
  });

  it('keeps decision and node links in sync both ways', () => {
    const ctx = makeCtx();
    const a = addComponent(newDoc(ctx), { type: 'cache', position: { x: 0, y: 0 } }, ctx);
    const d = recordDecision(a.doc, { title: 'Cache-aside', relatedNodeIds: [a.id] }, ctx);
    expect(d.doc.architecture.nodes[0]?.relatedDecisionIds).toEqual([d.id]);
    const unlinked = updateDecision(d.doc, d.id, { relatedNodeIds: [] }, ctx);
    expect(unlinked.architecture.nodes[0]?.relatedDecisionIds).toEqual([]);
    const removed = removeDecision(d.doc, d.id, ctx);
    expect(removed.architecture.nodes[0]?.relatedDecisionIds).toEqual([]);
  });
});

describe('change tracking against the last review', () => {
  it('reports nothing significant before any review', () => {
    const doc = newDoc();
    expect(computeChanges(doc)).toMatchObject({ hasBaseline: false, significant: false });
  });

  it('detects added, modified and removed items but ignores dragging', () => {
    const ctx = makeCtx();
    const a = addComponent(newDoc(ctx), { type: 'service', position: { x: 0, y: 0 } }, ctx);
    let doc = setReviewBaseline(a.doc, takeBaseline(a.doc, ctx.now()), ctx);
    expect(computeChanges(doc).entries).toHaveLength(0);

    doc = moveComponents(doc, { [a.id]: { x: 400, y: 400 } }, ctx);
    expect(computeChanges(doc).entries).toHaveLength(0);

    doc = updateComponent(doc, a.id, { technologies: 'Go' }, ctx);
    const b = addComponent(doc, { type: 'cache', position: { x: 1, y: 1 } }, ctx);
    doc = addRequirement(b.doc, { kind: 'functional', title: 'Redirect' }, ctx).doc;
    const entries = computeChanges(doc);
    expect(entries.significant).toBe(true);
    expect(entries.entries.map((e) => `${e.kind}:${e.subject}`).sort()).toEqual([
      'added:component',
      'added:requirement',
      'modified:component',
    ]);

    const removed = removeComponents(doc, [b.id], ctx);
    expect(computeChanges(removed).entries.some((e) => e.kind === 'removed')).toBe(false);
    const gone = removeComponents(removed, [a.id], ctx);
    const removal = computeChanges(gone).entries.find((e) => e.kind === 'removed');
    expect(removal?.label).toBe('Service');
  });
});
