import { AIError, isAIError } from '@/ai/errors';
import type { AIProvider, ProviderId } from '@/ai/provider-interface';
import { takeBaseline } from '@/features/design-review/changes';
import { runInterviewerTurn, type TurnResult } from '@/features/design-review/interviewer';
import {
  foldHistory,
  planFold,
  summaryTargetWords,
} from '@/features/design-review/history-summary';
import { SNAPSHOT_WARN_CHARS, buildSnapshotDetailed } from '@/features/design-review/snapshot';
import type { ProblemPack } from '@/features/problem-library/schema';
import type { InterviewMode, SessionDocument } from '@/types/session';
import { defaultContext, type Context } from '@/utils/context';
import {
  addReview,
  addSummary,
  appendMessage,
  setHistorySummary,
  setPendingQuestion,
  setReviewBaseline,
} from './commands';

export interface AiRequestState {
  status: 'idle' | 'running' | 'error';
  mode?: InterviewMode;
  error?: { message: string; retryable: boolean; kind: string };
}

interface LastRequest {
  mode: InterviewMode;
  answer?: string;
  answerRecorded: boolean;
}

export interface InterviewDeps {
  getDoc(): SessionDocument | null;
  getPack(): ProblemPack | null;
  update(mutator: (doc: SessionDocument) => SessionDocument): void;
  getSettings(): { provider: ProviderId; model: string };
  getProvider(id: ProviderId): AIProvider;
  hasKey(id: ProviderId): Promise<boolean>;
  onState(state: AiRequestState): void;
  ctx?: Context;
}

export interface InterviewService {
  request(mode: InterviewMode): Promise<void>;
  submitAnswer(text: string): Promise<void>;
  retry(): Promise<void>;
  cancel(): void;
  // Folds older chat into the stored summary when it is enabled and enough has piled up.
  refreshSummary(): Promise<void>;
}

// Orchestrates one interviewer turn. UI-independent so the workflow can be tested without rendering.
export function createInterviewService(deps: InterviewDeps): InterviewService {
  const ctx = deps.ctx ?? defaultContext;
  let controller: AbortController | null = null;
  let last: LastRequest | null = null;
  let summarizing: Promise<void> | null = null;

  const refreshSummary = (): Promise<void> => {
    if (summarizing) return summarizing;
    summarizing = (async () => {
      const doc = deps.getDoc();
      if (!doc?.historySummary.enabled) return;
      const pack = deps.getPack();
      const nearLimit =
        pack !== null &&
        buildSnapshotDetailed(doc, pack, 'architecture-review', ctx.now()).fullChars >=
          SNAPSHOT_WARN_CHARS;
      const plan = planFold(doc, { early: nearLimit });
      if (!plan) return;
      const { provider: providerId, model } = deps.getSettings();
      if (!model.trim()) return;
      const coveredBefore = doc.historySummary.coversThroughMessageId;
      try {
        if (!(await deps.hasKey(providerId))) return;
        const folded = await foldHistory({
          provider: deps.getProvider(providerId),
          model,
          previousSummary: doc.historySummary.text,
          messages: plan.messages,
          targetWords: summaryTargetWords(plan.totalFolded),
        });
        const through = plan.messages[folded.foldedMessages - 1];
        if (!through) return;
        // Skip if the session changed or the summary was reset while the call ran.
        deps.update((d) =>
          d.id === doc.id && d.historySummary.coversThroughMessageId === coveredBefore
            ? setHistorySummary(
                d,
                { text: folded.summary, coversThroughMessageId: through.id },
                ctx,
              )
            : d,
        );
      } catch {
        // The normal recent-message window keeps being used until a later attempt succeeds.
      }
    })().finally(() => {
      summarizing = null;
    });
    return summarizing;
  };

  const fail = (mode: InterviewMode, e: unknown) => {
    const err = isAIError(e) ? e : new AIError('unknown');
    if (err.kind === 'cancelled') {
      deps.onState({ status: 'idle' });
      return;
    }
    deps.onState({
      status: 'error',
      mode,
      error: { message: err.message, retryable: true, kind: err.kind },
    });
  };

  const commit = (snapshotDoc: SessionDocument, result: TurnResult) => {
    deps.update((doc) => {
      let next = appendMessage(
        doc,
        {
          role: 'interviewer',
          mode: result.mode,
          content: result.content,
          basedOnRevision: result.basedOnRevision,
        },
        ctx,
      );
      if (result.review) {
        next = addReview(next, result.review.review, result.review.findings, ctx);
        // The baseline is the design that was reviewed, so edits made while waiting still count as changes.
        next = setReviewBaseline(next, takeBaseline(snapshotDoc, ctx.now()), ctx);
      }
      if (result.summary) next = addSummary(next, result.summary, ctx);
      return setPendingQuestion(next, result.pendingQuestion, ctx);
    });
  };

  const run = async (request: LastRequest): Promise<void> => {
    const doc = deps.getDoc();
    const pack = deps.getPack();
    if (!doc || !pack) return;
    last = request;
    const { provider: providerId, model } = deps.getSettings();

    try {
      if (!(await deps.hasKey(providerId))) throw new AIError('missing-key');
      if (!model.trim()) throw new AIError('unsupported-model');

      // The candidate's own text is saved before the call so a provider failure never loses it.
      if (request.answer !== undefined && !request.answerRecorded) {
        deps.update((d) =>
          appendMessage(
            d,
            {
              role: 'candidate',
              content: request.answer ?? '',
              questionId: d.pendingQuestion?.id,
              basedOnRevision: d.revision,
            },
            ctx,
          ),
        );
        request.answerRecorded = true;
      }

      const snapshotDoc = deps.getDoc() ?? doc;
      controller = new AbortController();
      deps.onState({ status: 'running', mode: request.mode });
      const result = await runInterviewerTurn({
        mode: request.mode,
        doc: snapshotDoc,
        pack,
        provider: deps.getProvider(providerId),
        model,
        candidateAnswer: request.answer,
        options: { signal: controller.signal },
        ctx,
      });
      commit(snapshotDoc, result);
      last = null;
      deps.onState({ status: 'idle' });
      void refreshSummary();
    } catch (e) {
      fail(request.mode, e);
    } finally {
      controller = null;
    }
  };

  return {
    request: (mode) => run({ mode, answerRecorded: false }),
    submitAnswer: (text) => {
      const trimmed = text.trim();
      if (!trimmed) return Promise.resolve();
      const mode = deps.getDoc()?.pendingQuestion?.mode ?? 'architecture-interview';
      return run({ mode, answer: trimmed, answerRecorded: false });
    },
    retry: () => (last ? run(last) : Promise.resolve()),
    cancel: () => controller?.abort(),
    refreshSummary,
  };
}
