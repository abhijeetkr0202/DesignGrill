import { z } from 'zod';
import { FindingKindSchema, RubricCriterionSchema, SeveritySchema } from '@/types/session';

// Lenient on casing and length, strict on structure: the model's text never becomes trusted state.
const str = (max: number) => z.string().transform((s) => s.trim().slice(0, max));
const lower = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), schema);
const strings = (maxItems: number, max = 600) => z.array(str(max)).max(maxItems).default([]);
const ids = z.array(z.string().max(128)).max(50).default([]);

export const QuestionDraftSchema = z.object({
  text: str(1500).pipe(z.string().min(1)),
  reason: str(1000).optional(),
});
export type QuestionDraft = z.infer<typeof QuestionDraftSchema>;

export const FindingDraftSchema = z.object({
  kind: lower(FindingKindSchema),
  severity: lower(SeveritySchema),
  title: str(200).pipe(z.string().min(1)),
  affectedNodeIds: ids,
  affectedEdgeIds: ids,
  relatedRequirementIds: ids,
  reasoning: str(3000),
  conditions: str(1500).optional(),
  impact: str(1500).optional(),
  mitigations: z
    .array(z.object({ description: str(1500), tradeoffs: str(1500).optional() }))
    .max(8)
    .default([]),
  confidence: lower(z.enum(['high', 'medium', 'low'])),
});
export type FindingDraft = z.infer<typeof FindingDraftSchema>;

export const ReviewResponseSchema = z.object({
  overview: str(3000),
  findings: z.array(FindingDraftSchema).max(25).default([]),
  missingInformation: strings(10),
  followUpQuestion: QuestionDraftSchema.nullish(),
});
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

export const DiscoveryResponseSchema = z.object({
  observations: strings(8),
  question: QuestionDraftSchema,
  remainingUnknowns: strings(10),
});
export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>;

export const InterviewQuestionResponseSchema = z.object({
  commentary: str(2000).optional(),
  question: QuestionDraftSchema,
  groundedIn: strings(6, 200),
});
export type InterviewQuestionResponse = z.infer<typeof InterviewQuestionResponseSchema>;

export const ScenarioResponseSchema = z.object({
  scenarioTitle: str(200).pipe(z.string().min(1)),
  scenario: str(2000).pipe(z.string().min(1)),
  question: QuestionDraftSchema,
});
export type ScenarioResponse = z.infer<typeof ScenarioResponseSchema>;

export const AnswerEvaluationSchema = z.object({
  assessment: str(2500).pipe(z.string().min(1)),
  strengths: strings(6),
  gaps: strings(8),
  designSuggestions: strings(6, 800),
  followUpQuestion: QuestionDraftSchema.nullish(),
});
export type AnswerEvaluation = z.infer<typeof AnswerEvaluationSchema>;

export const SummaryResponseSchema = z.object({
  requirementsUnderstood: strings(15),
  architectureOverview: str(3000),
  keyDecisions: z
    .array(z.object({ decision: str(300), rationale: str(1500) }))
    .max(15)
    .default([]),
  strengths: strings(10),
  risks: strings(10),
  improvements: strings(10),
  tradeoffs: strings(10),
  unresolvedQuestions: strings(10),
  practiceTopics: strings(10, 300),
  rubric: z
    .array(
      z.object({
        criterion: lower(RubricCriterionSchema),
        score: z.coerce.number().int().min(0).max(4),
        evidence: str(800),
      }),
    )
    .max(7)
    .default([]),
});
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

export const HistorySummaryResponseSchema = z.object({
  summary: str(6000).pipe(z.string().min(1)),
});
