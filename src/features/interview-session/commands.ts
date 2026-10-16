import type {
  ArchEdge,
  ArchNode,
  ComponentType,
  Decision,
  Finding,
  Message,
  PendingQuestion,
  Requirement,
  Review,
  SessionDocument,
  SessionSummary,
} from '@/types/session';
import { SCHEMA_VERSION } from '@/types/session';
import { defaultContext, type Context } from '@/utils/context';

export interface NewSessionInput {
  problemId: string;
  problemVersion: number;
  title: string;
}

export function createSession(
  input: NewSessionInput,
  ctx: Context = defaultContext,
): SessionDocument {
  const now = ctx.now();
  return {
    id: ctx.newId('ses'),
    problemId: input.problemId,
    problemVersion: input.problemVersion,
    title: input.title,
    status: 'in-progress',
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    requirements: [],
    architecture: { id: ctx.newId('arch'), schemaVersion: SCHEMA_VERSION, nodes: [], edges: [] },
    decisions: [],
    messages: [],
    reviews: [],
    findings: [],
    summaries: [],
    pendingQuestion: null,
    reviewBaseline: null,
  };
}

// `semantic` edits change what a reviewer would see; moves and chat messages do not.
function touch(doc: SessionDocument, ctx: Context, semantic: boolean): SessionDocument {
  return { ...doc, updatedAt: ctx.now(), revision: semantic ? doc.revision + 1 : doc.revision };
}

// ---------- Requirements ----------

export type RequirementInput = Pick<Requirement, 'kind' | 'title'> &
  Partial<Omit<Requirement, 'id' | 'kind' | 'title' | 'createdAt' | 'updatedAt'>>;

export function addRequirement(
  doc: SessionDocument,
  input: RequirementInput,
  ctx: Context = defaultContext,
): { doc: SessionDocument; id: string } {
  const now = ctx.now();
  const req: Requirement = {
    status: 'unresolved',
    ...input,
    id: ctx.newId('req'),
    createdAt: now,
    updatedAt: now,
  };
  return {
    doc: touch({ ...doc, requirements: [...doc.requirements, req] }, ctx, true),
    id: req.id,
  };
}

const REEVALUATION_FIELDS: (keyof Requirement)[] = [
  'title',
  'detail',
  'target',
  'category',
  'priority',
];

function flagDecisionsForRequirement(
  decisions: Decision[],
  requirementId: string,
  reason: string,
  now: string,
): Decision[] {
  return decisions.map((d) =>
    d.relatedRequirementIds.includes(requirementId) && d.status !== 'needs-reevaluation'
      ? { ...d, status: 'needs-reevaluation', reevaluationReason: reason, updatedAt: now }
      : d,
  );
}

export function updateRequirement(
  doc: SessionDocument,
  id: string,
  patch: Partial<Omit<Requirement, 'id' | 'createdAt' | 'updatedAt'>>,
  ctx: Context = defaultContext,
): SessionDocument {
  const existing = doc.requirements.find((r) => r.id === id);
  if (!existing) return doc;
  const next: Requirement = { ...existing, ...patch, updatedAt: ctx.now() };
  const meaningful =
    existing.kind !== 'openQuestion' && REEVALUATION_FIELDS.some((f) => existing[f] !== next[f]);
  const decisions = meaningful
    ? flagDecisionsForRequirement(
        doc.decisions,
        id,
        `Requirement "${next.title}" changed`,
        next.updatedAt,
      )
    : doc.decisions;
  return touch(
    { ...doc, requirements: doc.requirements.map((r) => (r.id === id ? next : r)), decisions },
    ctx,
    true,
  );
}

export function removeRequirement(
  doc: SessionDocument,
  id: string,
  ctx: Context = defaultContext,
): SessionDocument {
  const existing = doc.requirements.find((r) => r.id === id);
  if (!existing) return doc;
  const now = ctx.now();
  const flagged = flagDecisionsForRequirement(
    doc.decisions,
    id,
    `Requirement "${existing.title}" was removed`,
    now,
  );
  const decisions = flagged.map((d) => ({
    ...d,
    relatedRequirementIds: d.relatedRequirementIds.filter((r) => r !== id),
  }));
  return touch(
    { ...doc, requirements: doc.requirements.filter((r) => r.id !== id), decisions },
    ctx,
    true,
  );
}

// ---------- Architecture ----------

export interface ComponentInput {
  type: ComponentType;
  label?: string;
  position: { x: number; y: number };
}

const DEFAULT_LABELS: Record<ComponentType, string> = {
  client: 'Client',
  'load-balancer': 'Load Balancer',
  'api-gateway': 'API Gateway',
  service: 'Service',
  database: 'Database',
  cache: 'Cache',
  queue: 'Queue',
  'object-storage': 'Object Storage',
  'search-index': 'Search Index',
  'external-provider': 'External Provider',
  custom: 'Component',
};

export function defaultLabelFor(type: ComponentType): string {
  return DEFAULT_LABELS[type];
}

export function addComponent(
  doc: SessionDocument,
  input: ComponentInput,
  ctx: Context = defaultContext,
): { doc: SessionDocument; id: string } {
  const node: ArchNode = {
    id: ctx.newId('node'),
    type: input.type,
    label: input.label?.trim() || defaultLabelFor(input.type),
    position: input.position,
    relatedDecisionIds: [],
  };
  const architecture = { ...doc.architecture, nodes: [...doc.architecture.nodes, node] };
  return { doc: touch({ ...doc, architecture }, ctx, true), id: node.id };
}

export function updateComponent(
  doc: SessionDocument,
  id: string,
  patch: Partial<Omit<ArchNode, 'id' | 'position'>>,
  ctx: Context = defaultContext,
): SessionDocument {
  if (!doc.architecture.nodes.some((n) => n.id === id)) return doc;
  const nodes = doc.architecture.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n));
  return touch({ ...doc, architecture: { ...doc.architecture, nodes } }, ctx, true);
}

export function moveComponents(
  doc: SessionDocument,
  positions: Record<string, { x: number; y: number }>,
  ctx: Context = defaultContext,
): SessionDocument {
  let changed = false;
  const nodes = doc.architecture.nodes.map((n) => {
    const p = positions[n.id];
    if (!p || (p.x === n.position.x && p.y === n.position.y)) return n;
    changed = true;
    return { ...n, position: p };
  });
  if (!changed) return doc;
  return touch({ ...doc, architecture: { ...doc.architecture, nodes } }, ctx, false);
}

export function removeComponents(
  doc: SessionDocument,
  ids: string[],
  ctx: Context = defaultContext,
): SessionDocument {
  const remove = new Set(ids);
  if (!doc.architecture.nodes.some((n) => remove.has(n.id))) return doc;
  const nodes = doc.architecture.nodes.filter((n) => !remove.has(n.id));
  const edges = doc.architecture.edges.filter(
    (e) => !remove.has(e.source) && !remove.has(e.target),
  );
  const decisions = doc.decisions.map((d) =>
    d.relatedNodeIds.some((n) => remove.has(n))
      ? {
          ...d,
          relatedNodeIds: d.relatedNodeIds.filter((n) => !remove.has(n)),
          status: 'needs-reevaluation' as const,
          reevaluationReason: 'A related component was removed',
        }
      : d,
  );
  return touch(
    { ...doc, architecture: { ...doc.architecture, nodes, edges }, decisions },
    ctx,
    true,
  );
}

export interface ConnectionInput {
  source: string;
  target: string;
  label?: string;
  pattern?: ArchEdge['pattern'];
  protocol?: string;
  mode?: ArchEdge['mode'];
  dataFlow?: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export function connectComponents(
  doc: SessionDocument,
  input: ConnectionInput,
  ctx: Context = defaultContext,
): { doc: SessionDocument; id: string | null } {
  const { nodes, edges } = doc.architecture;
  const valid =
    input.source !== input.target &&
    nodes.some((n) => n.id === input.source) &&
    nodes.some((n) => n.id === input.target);
  const duplicate = edges.some(
    (e) =>
      e.source === input.source &&
      e.target === input.target &&
      (e.label ?? '') === (input.label ?? ''),
  );
  if (!valid || duplicate) return { doc, id: null };
  const edge: ArchEdge = { ...input, id: ctx.newId('edge') };
  return {
    doc: touch(
      { ...doc, architecture: { ...doc.architecture, edges: [...edges, edge] } },
      ctx,
      true,
    ),
    id: edge.id,
  };
}

export function updateEdge(
  doc: SessionDocument,
  id: string,
  patch: Partial<Omit<ArchEdge, 'id' | 'source' | 'target'>>,
  ctx: Context = defaultContext,
): SessionDocument {
  if (!doc.architecture.edges.some((e) => e.id === id)) return doc;
  const edges = doc.architecture.edges.map((e) => (e.id === id ? { ...e, ...patch } : e));
  return touch({ ...doc, architecture: { ...doc.architecture, edges } }, ctx, true);
}

export function removeEdges(
  doc: SessionDocument,
  ids: string[],
  ctx: Context = defaultContext,
): SessionDocument {
  const remove = new Set(ids);
  if (!doc.architecture.edges.some((e) => remove.has(e.id))) return doc;
  const edges = doc.architecture.edges.filter((e) => !remove.has(e.id));
  return touch({ ...doc, architecture: { ...doc.architecture, edges } }, ctx, true);
}

// ---------- Decisions ----------

export type DecisionInput = Pick<Decision, 'title'> &
  Partial<
    Pick<Decision, 'rationale' | 'alternatives' | 'relatedNodeIds' | 'relatedRequirementIds'>
  >;

function syncNodeDecisionLinks(
  nodes: ArchNode[],
  decisionId: string,
  linked: string[],
): ArchNode[] {
  const set = new Set(linked);
  return nodes.map((n) => {
    const has = n.relatedDecisionIds.includes(decisionId);
    if (set.has(n.id) && !has)
      return { ...n, relatedDecisionIds: [...n.relatedDecisionIds, decisionId] };
    if (!set.has(n.id) && has) {
      return { ...n, relatedDecisionIds: n.relatedDecisionIds.filter((d) => d !== decisionId) };
    }
    return n;
  });
}

export function recordDecision(
  doc: SessionDocument,
  input: DecisionInput,
  ctx: Context = defaultContext,
): { doc: SessionDocument; id: string } {
  const now = ctx.now();
  const decision: Decision = {
    rationale: '',
    relatedNodeIds: [],
    relatedRequirementIds: [],
    ...input,
    id: ctx.newId('dec'),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  const nodes = syncNodeDecisionLinks(doc.architecture.nodes, decision.id, decision.relatedNodeIds);
  return {
    doc: touch(
      {
        ...doc,
        decisions: [...doc.decisions, decision],
        architecture: { ...doc.architecture, nodes },
      },
      ctx,
      true,
    ),
    id: decision.id,
  };
}

export function updateDecision(
  doc: SessionDocument,
  id: string,
  patch: Partial<Omit<Decision, 'id' | 'createdAt' | 'updatedAt'>>,
  ctx: Context = defaultContext,
): SessionDocument {
  const existing = doc.decisions.find((d) => d.id === id);
  if (!existing) return doc;
  const next: Decision = { ...existing, ...patch, updatedAt: ctx.now() };
  if (next.status === 'active') delete next.reevaluationReason;
  const nodes = syncNodeDecisionLinks(doc.architecture.nodes, id, next.relatedNodeIds);
  return touch(
    {
      ...doc,
      decisions: doc.decisions.map((d) => (d.id === id ? next : d)),
      architecture: { ...doc.architecture, nodes },
    },
    ctx,
    true,
  );
}

export function removeDecision(
  doc: SessionDocument,
  id: string,
  ctx: Context = defaultContext,
): SessionDocument {
  if (!doc.decisions.some((d) => d.id === id)) return doc;
  const nodes = syncNodeDecisionLinks(doc.architecture.nodes, id, []);
  return touch(
    {
      ...doc,
      decisions: doc.decisions.filter((d) => d.id !== id),
      architecture: { ...doc.architecture, nodes },
    },
    ctx,
    true,
  );
}

// ---------- Interview ----------

export function appendMessage(
  doc: SessionDocument,
  input: Omit<Message, 'id' | 'createdAt'>,
  ctx: Context = defaultContext,
): SessionDocument {
  const message: Message = { ...input, id: ctx.newId('msg'), createdAt: ctx.now() };
  return touch({ ...doc, messages: [...doc.messages, message] }, ctx, false);
}

export function setPendingQuestion(
  doc: SessionDocument,
  question: PendingQuestion | null,
  ctx: Context = defaultContext,
): SessionDocument {
  return touch({ ...doc, pendingQuestion: question }, ctx, false);
}

export function addReview(
  doc: SessionDocument,
  review: Review,
  findings: Finding[],
  ctx: Context = defaultContext,
): SessionDocument {
  return touch(
    { ...doc, reviews: [...doc.reviews, review], findings: [...doc.findings, ...findings] },
    ctx,
    false,
  );
}

export function setFindingStatus(
  doc: SessionDocument,
  id: string,
  status: Finding['status'],
  ctx: Context = defaultContext,
): SessionDocument {
  if (!doc.findings.some((f) => f.id === id)) return doc;
  return touch(
    { ...doc, findings: doc.findings.map((f) => (f.id === id ? { ...f, status } : f)) },
    ctx,
    false,
  );
}

export function addSummary(
  doc: SessionDocument,
  summary: SessionSummary,
  ctx: Context = defaultContext,
): SessionDocument {
  return touch({ ...doc, summaries: [...doc.summaries, summary] }, ctx, false);
}

export function setReviewBaseline(
  doc: SessionDocument,
  baseline: SessionDocument['reviewBaseline'],
  ctx: Context = defaultContext,
): SessionDocument {
  return touch({ ...doc, reviewBaseline: baseline }, ctx, false);
}

export function setSessionStatus(
  doc: SessionDocument,
  status: SessionDocument['status'],
  ctx: Context = defaultContext,
): SessionDocument {
  return touch({ ...doc, status }, ctx, false);
}

export function renameSession(
  doc: SessionDocument,
  title: string,
  ctx: Context = defaultContext,
): SessionDocument {
  const trimmed = title.trim();
  return trimmed ? touch({ ...doc, title: trimmed.slice(0, 300) }, ctx, false) : doc;
}
