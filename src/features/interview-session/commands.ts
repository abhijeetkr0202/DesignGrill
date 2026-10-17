import type {
  ArchEdge,
  ArchNode,
  ComponentType,
  Decision,
  Drawing,
  Finding,
  Message,
  PendingQuestion,
  Requirement,
  Review,
  SessionDocument,
  SessionSummary,
} from '@/types/session';
import { EMPTY_HISTORY_SUMMARY, INITIAL_GROWTH_STAGE, SCHEMA_VERSION } from '@/types/session';
import { GROWTH_STAGES } from '@/features/design-review/stages';
import { defaultContext, type Context } from '@/utils/context';

export interface NewSessionInput {
  problemId: string;
  problemVersion: number;
  title: string;
  problemStatement?: string;
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
    architecture: {
      id: ctx.newId('arch'),
      schemaVersion: SCHEMA_VERSION,
      nodes: [],
      edges: [],
      drawings: [],
    },
    decisions: [],
    messages: [],
    reviews: [],
    findings: [],
    summaries: [],
    pendingQuestion: null,
    reviewBaseline: null,
    problemStatement: input.problemStatement ?? '',
    historySummary: { ...EMPTY_HISTORY_SUMMARY },
    growthStage: { ...INITIAL_GROWTH_STAGE },
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
  const move = <T extends { id: string }>(
    item: T,
    current: { x: number; y: number },
    apply: (p: { x: number; y: number }) => T,
  ): T => {
    const p = positions[item.id];
    if (!p || (p.x === current.x && p.y === current.y)) return item;
    changed = true;
    return apply(p);
  };
  const nodes = doc.architecture.nodes.map((n) =>
    move(n, n.position, (position) => ({ ...n, position })),
  );
  const drawings = doc.architecture.drawings.map((d) =>
    move(d, d, (p) => ({ ...d, x: p.x, y: p.y })),
  );
  if (!changed) return doc;
  return touch({ ...doc, architecture: { ...doc.architecture, nodes, drawings } }, ctx, false);
}

// ---------- Drawings (free-form notes the interviewer also sees) ----------

export type DrawingInput = Omit<Drawing, 'id'>;

export function addDrawing(
  doc: SessionDocument,
  input: DrawingInput,
  ctx: Context = defaultContext,
): { doc: SessionDocument; id: string } {
  const drawing: Drawing = { ...input, id: ctx.newId('drw') };
  const architecture = { ...doc.architecture, drawings: [...doc.architecture.drawings, drawing] };
  return { doc: touch({ ...doc, architecture }, ctx, true), id: drawing.id };
}

// Only a change of text alters what a reviewer would read; colour, size and position do not.
export function updateDrawings(
  doc: SessionDocument,
  ids: string[],
  patch: Partial<Omit<Drawing, 'id' | 'kind'>>,
  ctx: Context = defaultContext,
): SessionDocument {
  const target = new Set(ids);
  const affected = doc.architecture.drawings.filter((d) => target.has(d.id));
  if (affected.length === 0) return doc;
  const semantic = 'text' in patch && affected.some((d) => d.text !== patch.text);
  const drawings = doc.architecture.drawings.map((d) =>
    target.has(d.id) ? { ...d, ...patch } : d,
  );
  return touch({ ...doc, architecture: { ...doc.architecture, drawings } }, ctx, semantic);
}

export function removeDrawings(
  doc: SessionDocument,
  ids: string[],
  ctx: Context = defaultContext,
): SessionDocument {
  const target = new Set(ids);
  if (!doc.architecture.drawings.some((d) => target.has(d.id))) return doc;
  const drawings = doc.architecture.drawings.filter((d) => !target.has(d.id));
  return touch({ ...doc, architecture: { ...doc.architecture, drawings } }, ctx, true);
}

// ---------- Copy and paste (for replicas, shards and repeated tiers) ----------

export interface ClipboardData {
  nodes: ArchNode[];
  // Only connections whose two ends are both copied.
  edges: ArchEdge[];
  drawings: Drawing[];
}

export function collectClipboard(doc: SessionDocument, ids: string[]): ClipboardData | null {
  const chosen = new Set(ids);
  const nodes = doc.architecture.nodes.filter((n) => chosen.has(n.id));
  const drawings = doc.architecture.drawings.filter((d) => chosen.has(d.id));
  if (nodes.length + drawings.length === 0) return null;
  const copied = new Set(nodes.map((n) => n.id));
  const edges = doc.architecture.edges.filter((e) => copied.has(e.source) && copied.has(e.target));
  return structuredClone({ nodes, edges, drawings });
}

export function clipboardBounds(data: ClipboardData): { x: number; y: number } {
  const xs = [...data.nodes.map((n) => n.position.x), ...data.drawings.map((d) => d.x)];
  const ys = [...data.nodes.map((n) => n.position.y), ...data.drawings.map((d) => d.y)];
  return { x: Math.min(...xs), y: Math.min(...ys) };
}

// Pasted copies get fresh ids and no decision links, so they start as independent components.
export function pasteClipboard(
  doc: SessionDocument,
  data: ClipboardData,
  offset: { dx: number; dy: number },
  ctx: Context = defaultContext,
): { doc: SessionDocument; ids: string[] } {
  if (data.nodes.length + data.drawings.length === 0) return { doc, ids: [] };
  const idMap = new Map(data.nodes.map((n) => [n.id, ctx.newId('node')] as const));
  const nodes = data.nodes.map((n): ArchNode => ({
    ...n,
    id: idMap.get(n.id) ?? n.id,
    position: { x: n.position.x + offset.dx, y: n.position.y + offset.dy },
    relatedDecisionIds: [],
  }));
  const edges = data.edges.flatMap((e): ArchEdge[] => {
    const source = idMap.get(e.source);
    const target = idMap.get(e.target);
    return source && target ? [{ ...e, id: ctx.newId('edge'), source, target }] : [];
  });
  const drawings = data.drawings.map((d): Drawing => ({
    ...d,
    id: ctx.newId('drw'),
    x: d.x + offset.dx,
    y: d.y + offset.dy,
  }));
  const architecture = {
    ...doc.architecture,
    nodes: [...doc.architecture.nodes, ...nodes],
    edges: [...doc.architecture.edges, ...edges],
    drawings: [...doc.architecture.drawings, ...drawings],
  };
  return {
    doc: touch({ ...doc, architecture }, ctx, true),
    ids: [...nodes.map((n) => n.id), ...drawings.map((d) => d.id)],
  };
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

// ---------- Chat history summary ----------

export function setHistorySummaryEnabled(
  doc: SessionDocument,
  enabled: boolean,
  ctx: Context = defaultContext,
): SessionDocument {
  if (doc.historySummary.enabled === enabled) return doc;
  return touch({ ...doc, historySummary: { ...doc.historySummary, enabled } }, ctx, false);
}

export function setHistorySummary(
  doc: SessionDocument,
  update: { text: string; coversThroughMessageId: string | null },
  ctx: Context = defaultContext,
): SessionDocument {
  const text = update.text.trim().slice(0, 6000);
  const next = {
    ...doc.historySummary,
    text,
    coversThroughMessageId: update.coversThroughMessageId,
  };
  return touch({ ...doc, historySummary: { ...next, updatedAt: ctx.now() } }, ctx, false);
}

// Keeps the covered range; used when the user corrects the generated text by hand.
export function editHistorySummaryText(
  doc: SessionDocument,
  text: string,
  ctx: Context = defaultContext,
): SessionDocument {
  const next = text.trim().slice(0, 6000);
  if (next === doc.historySummary.text) return doc;
  return setHistorySummary(
    doc,
    { text: next, coversThroughMessageId: doc.historySummary.coversThroughMessageId },
    ctx,
  );
}

// Dropping the summary makes the full recent chat window apply again until a new one is built.
export function resetHistorySummary(
  doc: SessionDocument,
  ctx: Context = defaultContext,
): SessionDocument {
  return touch(
    {
      ...doc,
      historySummary: { ...EMPTY_HISTORY_SUMMARY, enabled: doc.historySummary.enabled },
    },
    ctx,
    false,
  );
}

// Starts the conversation over. The design, decisions, findings and reviews are kept; the
// current stage is kept too but will be announced again by the next reply.
export function clearChat(doc: SessionDocument, ctx: Context = defaultContext): SessionDocument {
  if (doc.messages.length === 0 && doc.pendingQuestion === null) return doc;
  return touch(
    {
      ...doc,
      messages: [],
      pendingQuestion: null,
      historySummary: { ...EMPTY_HISTORY_SUMMARY, enabled: doc.historySummary.enabled },
      growthStage: { ...doc.growthStage, introduced: false },
    },
    ctx,
    false,
  );
}

export function setSessionStatus(
  doc: SessionDocument,
  status: SessionDocument['status'],
  ctx: Context = defaultContext,
): SessionDocument {
  return touch({ ...doc, status }, ctx, false);
}

// ---------- Progressive interview ----------

export function setGrowthStage(
  doc: SessionDocument,
  index: number,
  ctx: Context = defaultContext,
): SessionDocument {
  const next = Math.max(0, Math.min(GROWTH_STAGES.length - 1, Math.trunc(index)));
  if (next === doc.growthStage.index) return doc;
  return touch({ ...doc, growthStage: { index: next, introduced: false } }, ctx, false);
}

export function markStageIntroduced(
  doc: SessionDocument,
  ctx: Context = defaultContext,
): SessionDocument {
  if (doc.growthStage.introduced) return doc;
  return touch({ ...doc, growthStage: { ...doc.growthStage, introduced: true } }, ctx, false);
}

export function renameSession(
  doc: SessionDocument,
  title: string,
  ctx: Context = defaultContext,
): SessionDocument {
  const trimmed = title.trim();
  return trimmed ? touch({ ...doc, title: trimmed.slice(0, 300) }, ctx, false) : doc;
}

export function setProblemStatement(
  doc: SessionDocument,
  statement: string,
  ctx: Context = defaultContext,
): SessionDocument {
  const next = statement.trim().slice(0, 8000);
  return next === doc.problemStatement ? doc : touch({ ...doc, problemStatement: next }, ctx, true);
}
