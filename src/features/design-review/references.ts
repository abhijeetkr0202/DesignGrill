import type { Finding, RelatedRefs, SessionDocument } from '@/types/session';

const MAX_REFS = 8;

const empty = (): RelatedRefs => ({ nodeIds: [], edgeIds: [], requirementIds: [] });

// Model output is untrusted: only ids that exist in the session survive. Entries may be written as
// an id or as the component, connection, or requirement name.
export function resolveRefs(doc: SessionDocument, items: string[]): RelatedRefs {
  const refs = empty();
  const nodes = doc.architecture.nodes;
  const edges = doc.architecture.edges;
  const nodeLabel = new Map(nodes.map((n) => [n.id, n.label]));
  for (const raw of items) {
    const item = raw.trim();
    if (!item) continue;
    const lower = item.toLowerCase();
    const node =
      nodes.find((n) => n.id === item) ?? nodes.find((n) => n.label.toLowerCase() === lower);
    if (node) {
      refs.nodeIds.push(node.id);
      continue;
    }
    const edge =
      edges.find((e) => e.id === item) ??
      edges.find((e) => {
        const from = nodeLabel.get(e.source)?.toLowerCase();
        const to = nodeLabel.get(e.target)?.toLowerCase();
        return from !== undefined && to !== undefined && lower === `${from} → ${to}`;
      });
    if (edge) {
      refs.edgeIds.push(edge.id);
      continue;
    }
    const req =
      doc.requirements.find((r) => r.id === item) ??
      doc.requirements.find((r) => r.title.toLowerCase() === lower);
    if (req) refs.requirementIds.push(req.id);
  }
  return refs;
}

export function refsFromFindings(findings: Finding[]): RelatedRefs {
  const refs = empty();
  for (const f of findings) {
    if (f.kind === 'strength') continue;
    refs.nodeIds.push(...f.affectedNodeIds);
    refs.edgeIds.push(...f.affectedEdgeIds);
    refs.requirementIds.push(...f.relatedRequirementIds);
  }
  return refs;
}

// Combines sources, drops duplicates, bounds the size, and returns undefined when nothing remains.
export function mergeRefs(...sources: (RelatedRefs | undefined)[]): RelatedRefs | undefined {
  const merged = empty();
  for (const s of sources) {
    if (!s) continue;
    merged.nodeIds.push(...s.nodeIds);
    merged.edgeIds.push(...s.edgeIds);
    merged.requirementIds.push(...s.requirementIds);
  }
  const unique = (list: string[]) => [...new Set(list)].slice(0, MAX_REFS);
  const result: RelatedRefs = {
    nodeIds: unique(merged.nodeIds),
    edgeIds: unique(merged.edgeIds),
    requirementIds: unique(merged.requirementIds),
  };
  return result.nodeIds.length || result.edgeIds.length || result.requirementIds.length
    ? result
    : undefined;
}

// The candidate's selection, kept only where the elements still exist.
export function focusRefs(
  doc: SessionDocument,
  focus: { nodeIds: string[]; edgeIds: string[] } | undefined,
): RelatedRefs | undefined {
  if (!focus) return undefined;
  const nodeIds = doc.architecture.nodes
    .filter((n) => focus.nodeIds.includes(n.id))
    .map((n) => n.id);
  const edgeIds = doc.architecture.edges
    .filter((e) => focus.edgeIds.includes(e.id))
    .map((e) => e.id);
  return mergeRefs({ nodeIds, edgeIds, requirementIds: [] });
}
