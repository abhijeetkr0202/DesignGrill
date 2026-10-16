import { describeDrawings, drawingFingerprint } from '@/features/architecture/annotations';
import type { ReviewBaseline, SessionDocument } from '@/types/session';

// Fingerprints deliberately exclude node positions so dragging never counts as a design change.
const fp = (...parts: unknown[]) => JSON.stringify(parts);

export function takeBaseline(doc: SessionDocument, takenAt: string): ReviewBaseline {
  const nodes: Record<string, string> = {};
  for (const n of doc.architecture.nodes) {
    nodes[n.id] = fp(
      n.type,
      n.label,
      n.description,
      n.responsibility,
      n.technologies,
      n.configuration,
      n.bottlenecks,
      n.failureBehavior,
      n.scalingStrategy,
    );
  }
  const edges: Record<string, string> = {};
  for (const e of doc.architecture.edges) {
    edges[e.id] = fp(e.source, e.target, e.label, e.pattern, e.protocol, e.mode, e.dataFlow);
  }
  const requirements: Record<string, string> = {};
  for (const r of doc.requirements) {
    requirements[r.id] = fp(r.kind, r.title, r.detail, r.target, r.status, r.priority, r.category);
  }
  const decisions: Record<string, string> = {};
  for (const d of doc.decisions) {
    decisions[d.id] = fp(
      d.title,
      d.rationale,
      d.alternatives,
      d.relatedNodeIds,
      d.relatedRequirementIds,
      d.status,
    );
  }
  const labels: Record<string, string> = {};
  for (const n of doc.architecture.nodes) labels[n.id] = n.label;
  for (const r of doc.requirements) labels[r.id] = r.title;
  for (const d of doc.decisions) labels[d.id] = d.title;
  const drawings: Record<string, string> = {};
  for (const d of describeDrawings(doc.architecture)) {
    drawings[d.id] = drawingFingerprint(d);
    labels[d.id] = d.text ?? d.kind;
  }
  return {
    revision: doc.revision,
    takenAt,
    nodes,
    edges,
    requirements,
    decisions,
    drawings,
    labels,
  };
}

export type ChangeKind = 'added' | 'removed' | 'modified';
export type ChangeSubject = 'component' | 'connection' | 'requirement' | 'decision' | 'annotation';

export interface ChangeEntry {
  kind: ChangeKind;
  subject: ChangeSubject;
  id: string;
  label: string;
}

export interface ChangeSummary {
  hasBaseline: boolean;
  entries: ChangeEntry[];
  // Structural edits or requirement/decision changes warrant suggesting a fresh review.
  significant: boolean;
}

function diff(
  before: Record<string, string>,
  after: Record<string, string>,
  subject: ChangeSubject,
  labelOf: (id: string) => string,
  out: ChangeEntry[],
) {
  for (const id of Object.keys(after)) {
    if (!(id in before)) out.push({ kind: 'added', subject, id, label: labelOf(id) });
    else if (before[id] !== after[id])
      out.push({ kind: 'modified', subject, id, label: labelOf(id) });
  }
  for (const id of Object.keys(before)) {
    if (!(id in after)) out.push({ kind: 'removed', subject, id, label: labelOf(id) });
  }
}

export function computeChanges(doc: SessionDocument): ChangeSummary {
  const current = takeBaseline(doc, '');
  const base = doc.reviewBaseline;
  const entries: ChangeEntry[] = [];
  const nodeLabel = new Map(doc.architecture.nodes.map((n) => [n.id, n.label]));
  const reqLabel = new Map(doc.requirements.map((r) => [r.id, r.title]));
  const decLabel = new Map(doc.decisions.map((d) => [d.id, d.title]));
  const old = base?.labels ?? {};
  const nameOf = (id: string, map: Map<string, string>) => map.get(id) ?? old[id] ?? 'removed item';
  const edgeLabel = (id: string) => {
    const e = doc.architecture.edges.find((x) => x.id === id);
    if (!e) return 'removed connection';
    return `${nameOf(e.source, nodeLabel)} -> ${nameOf(e.target, nodeLabel)}`;
  };

  diff(base?.nodes ?? {}, current.nodes, 'component', (id) => nameOf(id, nodeLabel), entries);
  diff(base?.edges ?? {}, current.edges, 'connection', edgeLabel, entries);
  diff(
    base?.requirements ?? {},
    current.requirements,
    'requirement',
    (id) => nameOf(id, reqLabel),
    entries,
  );
  diff(base?.decisions ?? {}, current.decisions, 'decision', (id) => nameOf(id, decLabel), entries);
  diff(
    base?.drawings ?? {},
    current.drawings,
    'annotation',
    (id) => current.labels[id] ?? old[id] ?? 'removed annotation',
    entries,
  );

  return { hasBaseline: base !== null, entries, significant: base !== null && entries.length > 0 };
}
