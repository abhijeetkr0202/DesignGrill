import { completeStructured, type StructuredOptions } from '@/ai/structured';
import { buildSystemPrompt, type TaskKind } from '@/ai/prompts';
import type { AIProvider } from '@/ai/provider-interface';
import {
  AnswerEvaluationSchema,
  DiscoveryResponseSchema,
  InterviewQuestionResponseSchema,
  ReviewResponseSchema,
  ScenarioResponseSchema,
  SummaryResponseSchema,
  type FindingDraft,
  type QuestionDraft,
} from '@/ai/schemas/responses';
import type { ProblemPack } from '@/features/problem-library/schema';
import type {
  Finding,
  InterviewMode,
  PendingQuestion,
  Review,
  SessionDocument,
  SessionSummary,
} from '@/types/session';
import { defaultContext, type Context } from '@/utils/context';
import { buildSnapshot, snapshotToUserMessage } from './snapshot';

export interface TurnInput {
  mode: InterviewMode;
  doc: SessionDocument;
  pack: ProblemPack;
  provider: AIProvider;
  model: string;
  candidateAnswer?: string;
  // Staged interview: adds the stage to the snapshot and the progressive rules to the prompt.
  progressive?: boolean;
  options?: StructuredOptions;
  ctx?: Context;
}

export interface TurnResult {
  mode: InterviewMode;
  content: string;
  pendingQuestion: PendingQuestion | null;
  basedOnRevision: number;
  review?: { review: Review; findings: Finding[]; droppedReferences: number };
  summary?: SessionSummary;
}

const MAX_OUTPUT_TOKENS: Record<TaskKind, number> = {
  'requirements-discovery': 1500,
  'architecture-interview': 1200,
  'architecture-review': 4000,
  'failure-scenario': 1200,
  'answer-evaluation': 2000,
  'session-summary': 3500,
};

const bullets = (items: string[]) => items.map((i) => `- ${i}`).join('\n');

function section(title: string, items: string[]): string {
  return items.length ? `${title}\n${bullets(items)}` : '';
}

function joinParts(...parts: (string | undefined)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join('\n\n');
}

function toPending(
  q: QuestionDraft | null | undefined,
  mode: InterviewMode,
  revision: number,
  ctx: Context,
): PendingQuestion | null {
  if (!q) return null;
  return {
    id: ctx.newId('q'),
    text: q.text,
    mode,
    reason: q.reason,
    askedAt: ctx.now(),
    basedOnRevision: revision,
  };
}

function questionText(q: QuestionDraft | null | undefined): string {
  if (!q) return '';
  return q.reason ? `Question: ${q.text}\n(Why it matters: ${q.reason})` : `Question: ${q.text}`;
}

// Findings may only reference things that exist; unknown ids from the model are dropped, not trusted.
export function sanitizeFindings(
  drafts: FindingDraft[],
  doc: SessionDocument,
  reviewId: string,
  ctx: Context,
): { findings: Finding[]; dropped: number } {
  const nodeIds = new Set(doc.architecture.nodes.map((n) => n.id));
  const edgeIds = new Set(doc.architecture.edges.map((e) => e.id));
  const reqIds = new Set(doc.requirements.map((r) => r.id));
  let dropped = 0;
  const keep = (list: string[], valid: Set<string>) =>
    list.filter((id) => {
      if (valid.has(id)) return true;
      dropped++;
      return false;
    });
  const now = ctx.now();
  const findings = drafts.map((d): Finding => ({
    id: ctx.newId('fnd'),
    reviewId,
    kind: d.kind,
    severity: d.severity,
    title: d.title,
    affectedNodeIds: keep(d.affectedNodeIds, nodeIds),
    affectedEdgeIds: keep(d.affectedEdgeIds, edgeIds),
    relatedRequirementIds: keep(d.relatedRequirementIds, reqIds),
    reasoning: d.reasoning,
    conditions: d.conditions,
    impact: d.impact,
    mitigations: d.mitigations,
    confidence: d.confidence,
    status: 'open',
    createdAt: now,
  }));
  return { findings, dropped };
}

export async function runInterviewerTurn(input: TurnInput): Promise<TurnResult> {
  const { mode, doc, pack, provider, model } = input;
  const ctx = input.ctx ?? defaultContext;
  const answering = input.candidateAnswer !== undefined && input.candidateAnswer.trim() !== '';
  const task: TaskKind = answering ? 'answer-evaluation' : mode;
  const snapshot = buildSnapshot(doc, pack, task, ctx.now(), { progressive: input.progressive });
  const request = {
    model,
    system: buildSystemPrompt(task, { progressive: input.progressive }),
    messages: [
      {
        role: 'user' as const,
        content: snapshotToUserMessage(snapshot, answering ? input.candidateAnswer : undefined),
      },
    ],
    maxOutputTokens: MAX_OUTPUT_TOKENS[task],
  };
  const revision = doc.revision;
  const run = <S extends Parameters<typeof completeStructured>[2]>(schema: S) =>
    completeStructured(provider, request, schema, input.options);

  if (answering) {
    const r = await run(AnswerEvaluationSchema);
    const resultMode = doc.pendingQuestion?.mode ?? mode;
    return {
      mode: resultMode,
      basedOnRevision: revision,
      pendingQuestion: toPending(r.followUpQuestion, resultMode, revision, ctx),
      content: joinParts(
        r.assessment,
        section('What worked:', r.strengths),
        section('Gaps to address:', r.gaps),
        section('You could consider:', r.designSuggestions),
        questionText(r.followUpQuestion),
      ),
    };
  }

  switch (mode) {
    case 'requirements-discovery': {
      const r = await run(DiscoveryResponseSchema);
      return {
        mode,
        basedOnRevision: revision,
        pendingQuestion: toPending(r.question, mode, revision, ctx),
        content: joinParts(
          section('Observations:', r.observations),
          questionText(r.question),
          section('Other open unknowns:', r.remainingUnknowns),
        ),
      };
    }
    case 'architecture-interview': {
      const r = await run(InterviewQuestionResponseSchema);
      return {
        mode,
        basedOnRevision: revision,
        pendingQuestion: toPending(r.question, mode, revision, ctx),
        content: joinParts(r.commentary, questionText(r.question)),
      };
    }
    case 'failure-scenario': {
      const r = await run(ScenarioResponseSchema);
      return {
        mode,
        basedOnRevision: revision,
        pendingQuestion: toPending(r.question, mode, revision, ctx),
        content: joinParts(`Scenario: ${r.scenarioTitle}`, r.scenario, questionText(r.question)),
      };
    }
    case 'architecture-review': {
      const r = await run(ReviewResponseSchema);
      const reviewId = ctx.newId('rev');
      const { findings, dropped } = sanitizeFindings(r.findings, doc, reviewId, ctx);
      const review: Review = {
        id: reviewId,
        mode,
        overview: r.overview,
        missingInformation: r.missingInformation,
        basedOnRevision: revision,
        createdAt: ctx.now(),
      };
      const concerns = findings.filter((f) => f.kind !== 'strength').length;
      return {
        mode,
        basedOnRevision: revision,
        pendingQuestion: toPending(r.followUpQuestion, mode, revision, ctx),
        review: { review, findings, droppedReferences: dropped },
        content: joinParts(
          r.overview,
          `Recorded ${concerns} concern${concerns === 1 ? '' : 's'} and ${findings.length - concerns} strength${findings.length - concerns === 1 ? '' : 's'} in the Findings tab.`,
          section('Information I would need to judge this more firmly:', r.missingInformation),
          questionText(r.followUpQuestion),
        ),
      };
    }
    case 'session-summary': {
      const r = await run(SummaryResponseSchema);
      const summary: SessionSummary = {
        id: ctx.newId('sum'),
        createdAt: ctx.now(),
        basedOnRevision: revision,
        ...r,
      };
      return {
        mode,
        basedOnRevision: revision,
        pendingQuestion: null,
        summary,
        content: 'Session summary generated. See the Summary tab.',
      };
    }
  }
}
