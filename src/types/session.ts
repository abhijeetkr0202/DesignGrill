import { z } from 'zod';

export const SCHEMA_VERSION = 1;

const id = z.string().min(1).max(128);
const isoDate = z.string().min(1).max(64);
const shortText = z.string().max(300);
const longText = z.string().max(8000);

// ---------- Requirements ----------

export const REQUIREMENT_KINDS = [
  'functional',
  'nonFunctional',
  'assumption',
  'constraint',
  'estimate',
  'openQuestion',
] as const;
export const RequirementKindSchema = z.enum(REQUIREMENT_KINDS);
export type RequirementKind = z.infer<typeof RequirementKindSchema>;

export const NFR_CATEGORIES = [
  'availability',
  'latency',
  'throughput',
  'durability',
  'consistency',
  'retention',
  'scalability',
  'cost',
  'security',
  'other',
] as const;
export const NfrCategorySchema = z.enum(NFR_CATEGORIES);
export type NfrCategory = z.infer<typeof NfrCategorySchema>;

export const PrioritySchema = z.enum(['low', 'medium', 'high']);
export type Priority = z.infer<typeof PrioritySchema>;

export const RequirementSchema = z.object({
  id,
  kind: RequirementKindSchema,
  title: shortText,
  detail: longText.optional(),
  status: z.enum(['confirmed', 'unresolved']).default('unresolved'),
  priority: PrioritySchema.optional(),
  category: NfrCategorySchema.optional(),
  // Measurable target such as "p99 < 100 ms"; qualitative text is allowed.
  target: shortText.optional(),
  notes: longText.optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type Requirement = z.infer<typeof RequirementSchema>;

// ---------- Architecture ----------

export const COMPONENT_TYPES = [
  'client',
  'load-balancer',
  'api-gateway',
  'service',
  'database',
  'cache',
  'queue',
  'object-storage',
  'search-index',
  'external-provider',
  'custom',
] as const;
export const ComponentTypeSchema = z.enum(COMPONENT_TYPES);
export type ComponentType = z.infer<typeof ComponentTypeSchema>;

export const ArchNodeSchema = z.object({
  id,
  type: ComponentTypeSchema,
  label: shortText,
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  description: longText.optional(),
  responsibility: longText.optional(),
  technologies: shortText.optional(),
  configuration: longText.optional(),
  bottlenecks: longText.optional(),
  failureBehavior: longText.optional(),
  scalingStrategy: longText.optional(),
  relatedDecisionIds: z.array(id).default([]),
});
export type ArchNode = z.infer<typeof ArchNodeSchema>;

export const COMMUNICATION_PATTERNS = [
  'request-response',
  'publish-subscribe',
  'streaming',
  'batch',
  'other',
] as const;
export const CommunicationPatternSchema = z.enum(COMMUNICATION_PATTERNS);
export type CommunicationPattern = z.infer<typeof CommunicationPatternSchema>;

export const ArchEdgeSchema = z.object({
  id,
  source: id,
  target: id,
  label: shortText.optional(),
  pattern: CommunicationPatternSchema.optional(),
  protocol: shortText.optional(),
  mode: z.enum(['sync', 'async']).optional(),
  dataFlow: longText.optional(),
  // Layout hints only: which side of each node the line attaches to.
  sourceHandle: z.string().max(20).optional(),
  targetHandle: z.string().max(20).optional(),
});
export type ArchEdge = z.infer<typeof ArchEdgeSchema>;

// Free-form shapes drawn on the canvas. They are annotations rather than components, but the
// interviewer receives them (text and relations to components) as part of the design.
export const DRAWING_KINDS = [
  'rectangle',
  'rounded-rectangle',
  'ellipse',
  'circle',
  'diamond',
  'triangle',
  'line',
  'arrow',
  'text',
  'freehand',
] as const;
export const DrawingKindSchema = z.enum(DRAWING_KINDS);
export type DrawingKind = z.infer<typeof DrawingKindSchema>;

// 'auto' follows the theme text colour, 'none' means transparent.
export const ColorSchema = z.string().regex(/^(auto|none|#[0-9a-fA-F]{6})$/);

export const DrawingSchema = z.object({
  id,
  kind: DrawingKindSchema,
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().min(1).max(20000),
  height: z.number().finite().min(1).max(20000),
  stroke: ColorSchema.default('auto'),
  fill: ColorSchema.default('none'),
  strokeWidth: z.number().min(1).max(12).default(2),
  dashed: z.boolean().default(false),
  text: z.string().max(2000).optional(),
  // Lines and arrows run from the top-left to the bottom-right corner unless flipped.
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  // Freehand strokes: points normalised to the 0..1 box.
  points: z
    .array(z.tuple([z.number(), z.number()]))
    .max(600)
    .optional(),
});
export type Drawing = z.infer<typeof DrawingSchema>;

export const ArchitectureSchema = z.object({
  id,
  schemaVersion: z.number().int().default(SCHEMA_VERSION),
  nodes: z.array(ArchNodeSchema).max(2000),
  edges: z.array(ArchEdgeSchema).max(5000),
  drawings: z.array(DrawingSchema).max(2000).default([]),
});
export type Architecture = z.infer<typeof ArchitectureSchema>;

// ---------- Decisions ----------

export const DecisionSchema = z.object({
  id,
  title: shortText,
  rationale: longText.default(''),
  alternatives: longText.optional(),
  relatedNodeIds: z.array(id).default([]),
  relatedRequirementIds: z.array(id).default([]),
  status: z.enum(['active', 'needs-reevaluation']).default('active'),
  reevaluationReason: shortText.optional(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type Decision = z.infer<typeof DecisionSchema>;

// ---------- Interview ----------

export const INTERVIEW_MODES = [
  'requirements-discovery',
  'architecture-interview',
  'architecture-review',
  'failure-scenario',
  'session-summary',
] as const;
export const InterviewModeSchema = z.enum(INTERVIEW_MODES);
export type InterviewMode = z.infer<typeof InterviewModeSchema>;

export const MessageSchema = z.object({
  id,
  role: z.enum(['interviewer', 'candidate', 'system']),
  mode: InterviewModeSchema.optional(),
  content: z.string().max(20000),
  createdAt: isoDate,
  // Which model/version of the design this message was written against.
  basedOnRevision: z.number().int().optional(),
  questionId: id.optional(),
});
export type Message = z.infer<typeof MessageSchema>;

export const PendingQuestionSchema = z.object({
  id,
  text: z.string().max(4000),
  mode: InterviewModeSchema,
  reason: z.string().max(2000).optional(),
  askedAt: isoDate,
  basedOnRevision: z.number().int(),
});
export type PendingQuestion = z.infer<typeof PendingQuestionSchema>;

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
export const SeveritySchema = z.enum(SEVERITIES);
export type Severity = z.infer<typeof SeveritySchema>;

export const FINDING_KINDS = [
  'structural',
  'conditional',
  'question',
  'strength',
  'assumption',
] as const;
export const FindingKindSchema = z.enum(FINDING_KINDS);
export type FindingKind = z.infer<typeof FindingKindSchema>;

export const FindingSchema = z.object({
  id,
  reviewId: id,
  kind: FindingKindSchema,
  severity: SeveritySchema,
  title: shortText,
  affectedNodeIds: z.array(id).default([]),
  affectedEdgeIds: z.array(id).default([]),
  relatedRequirementIds: z.array(id).default([]),
  reasoning: longText,
  conditions: longText.optional(),
  impact: longText.optional(),
  mitigations: z
    .array(z.object({ description: longText, tradeoffs: longText.optional() }))
    .default([]),
  confidence: z.enum(['high', 'medium', 'low']),
  status: z.enum(['open', 'resolved', 'dismissed']).default('open'),
  createdAt: isoDate,
});
export type Finding = z.infer<typeof FindingSchema>;

export const ReviewSchema = z.object({
  id,
  mode: InterviewModeSchema,
  overview: longText,
  missingInformation: z.array(z.string().max(1000)).default([]),
  basedOnRevision: z.number().int(),
  createdAt: isoDate,
});
export type Review = z.infer<typeof ReviewSchema>;

export const RUBRIC_CRITERIA = [
  'requirements-clarification',
  'architecture-completeness',
  'scalability',
  'reliability',
  'data-modeling',
  'trade-offs',
  'communication',
] as const;
export const RubricCriterionSchema = z.enum(RUBRIC_CRITERIA);
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const SummarySchema = z.object({
  id,
  createdAt: isoDate,
  basedOnRevision: z.number().int(),
  requirementsUnderstood: z.array(z.string().max(1000)).default([]),
  architectureOverview: longText,
  keyDecisions: z.array(z.object({ decision: shortText, rationale: longText })).default([]),
  strengths: z.array(z.string().max(1000)).default([]),
  risks: z.array(z.string().max(1000)).default([]),
  improvements: z.array(z.string().max(1000)).default([]),
  tradeoffs: z.array(z.string().max(1000)).default([]),
  unresolvedQuestions: z.array(z.string().max(1000)).default([]),
  practiceTopics: z.array(z.string().max(500)).default([]),
  rubric: z
    .array(
      z.object({
        criterion: RubricCriterionSchema,
        score: z.number().int().min(0).max(4),
        evidence: z.string().max(1000),
      }),
    )
    .default([]),
});
export type SessionSummary = z.infer<typeof SummarySchema>;

// ---------- Session ----------

// A compact view of the design at the last review, used to compute "what changed".
export const ReviewBaselineSchema = z.object({
  revision: z.number().int(),
  takenAt: isoDate,
  nodes: z.record(z.string(), z.string()),
  edges: z.record(z.string(), z.string()),
  requirements: z.record(z.string(), z.string()),
  decisions: z.record(z.string(), z.string()),
  drawings: z.record(z.string(), z.string()).default({}),
  labels: z.record(z.string(), z.string()).default({}),
});
export type ReviewBaseline = z.infer<typeof ReviewBaselineSchema>;

// Optional condensed record of older chat, sent instead of those messages when `enabled`.
export const HistorySummarySchema = z.object({
  enabled: z.boolean().default(false),
  text: z.string().max(6000).default(''),
  // Messages up to and including this one are folded into `text`.
  coversThroughMessageId: id.nullable().default(null),
  updatedAt: isoDate.nullable().default(null),
});
export type HistorySummary = z.infer<typeof HistorySummarySchema>;
export const EMPTY_HISTORY_SUMMARY: HistorySummary = {
  enabled: false,
  text: '',
  coversThroughMessageId: null,
  updatedAt: null,
};

export const SessionExtraSchema = z.object({
  pendingQuestion: PendingQuestionSchema.nullable().default(null),
  reviewBaseline: ReviewBaselineSchema.nullable().default(null),
  // Written by the user for custom problems; empty for bundled problems.
  problemStatement: longText.default(''),
  historySummary: HistorySummarySchema.default(EMPTY_HISTORY_SUMMARY),
});
export type SessionExtra = z.infer<typeof SessionExtraSchema>;

export const SessionMetaSchema = z.object({
  id,
  problemId: id,
  problemVersion: z.number().int(),
  title: shortText,
  status: z.enum(['in-progress', 'completed']),
  schemaVersion: z.number().int(),
  revision: z.number().int().min(0),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type SessionMeta = z.infer<typeof SessionMetaSchema>;

export const SessionDocumentSchema = SessionMetaSchema.extend({
  requirements: z.array(RequirementSchema),
  architecture: ArchitectureSchema,
  decisions: z.array(DecisionSchema),
  messages: z.array(MessageSchema),
  reviews: z.array(ReviewSchema),
  findings: z.array(FindingSchema),
  summaries: z.array(SummarySchema),
  pendingQuestion: PendingQuestionSchema.nullable().default(null),
  reviewBaseline: ReviewBaselineSchema.nullable().default(null),
  problemStatement: longText.default(''),
  historySummary: HistorySummarySchema.default(EMPTY_HISTORY_SUMMARY),
});
export type SessionDocument = z.infer<typeof SessionDocumentSchema>;
