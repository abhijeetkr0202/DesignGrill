import { describe, expect, it } from 'vitest';
import {
  EARLY_TRIGGER,
  KEEP_RAW,
  SUMMARY_TRIGGER,
  planFold,
} from '@/features/design-review/history-summary';
import { SNAPSHOT_WARN_CHARS, buildSnapshotDetailed } from '@/features/design-review/snapshot';
import { appendMessage, setHistorySummaryEnabled } from '@/features/interview-session/commands';
import {
  createInterviewService,
  type InterviewDeps,
} from '@/features/interview-session/interview-service';
import type { SessionDocument } from '@/types/session';
import { FakeProvider, loadPack, makeCtx, newDoc } from './helpers';

function chat(count: number, chars: number, ctx = makeCtx()) {
  let doc = newDoc(ctx);
  for (let i = 1; i <= count; i++) {
    doc = appendMessage(
      doc,
      { role: i % 2 ? 'interviewer' : 'candidate', content: 'x'.repeat(chars) },
      ctx,
    );
  }
  return { doc, ctx };
}

describe('early folding when the request is large', () => {
  it('uses a lower message threshold only when asked', () => {
    const { doc } = chat(EARLY_TRIGGER, 10);
    expect(EARLY_TRIGGER).toBeLessThan(SUMMARY_TRIGGER);
    expect(planFold(doc)).toBeNull();
    const plan = planFold(doc, { early: true })!;
    expect(plan.messages).toHaveLength(EARLY_TRIGGER - KEEP_RAW);
  });

  it('folds before the normal trigger once the snapshot is near its limit', async () => {
    const pack = await loadPack();
    // The newest messages stay verbatim and make the request large; the older ones fold in one call.
    const ctx = makeCtx();
    let raw = newDoc(ctx);
    for (let i = 1; i <= EARLY_TRIGGER; i++) {
      const size = i > EARLY_TRIGGER - KEEP_RAW ? 12_000 : 500;
      raw = appendMessage(
        raw,
        { role: i % 2 ? 'interviewer' : 'candidate', content: 'x'.repeat(size) },
        ctx,
      );
    }
    const doc = setHistorySummaryEnabled(raw, true, ctx);
    expect(
      buildSnapshotDetailed(doc, pack, 'architecture-review', 'now').fullChars,
    ).toBeGreaterThan(SNAPSHOT_WARN_CHARS);

    const state = { doc: doc as SessionDocument };
    const provider = new FakeProvider([JSON.stringify({ summary: '- early fold' })]);
    const deps: InterviewDeps = {
      getDoc: () => state.doc,
      getPack: () => pack,
      update: (m) => {
        state.doc = m(state.doc);
      },
      getSettings: () => ({ provider: 'openai', model: 'm' }),
      getProvider: () => provider,
      hasKey: async () => true,
      onState: () => undefined,
      ctx,
    };
    await createInterviewService(deps).refreshSummary();

    expect(provider.requests).toHaveLength(1);
    expect(state.doc.historySummary.text).toBe('- early fold');
  });

  it('does not fold early for a small session', async () => {
    const pack = await loadPack();
    const { doc: raw, ctx } = chat(EARLY_TRIGGER, 50);
    const state = { doc: setHistorySummaryEnabled(raw, true, ctx) };
    const provider = new FakeProvider([]);
    const deps: InterviewDeps = {
      getDoc: () => state.doc,
      getPack: () => pack,
      update: (m) => {
        state.doc = m(state.doc);
      },
      getSettings: () => ({ provider: 'openai', model: 'm' }),
      getProvider: () => provider,
      hasKey: async () => true,
      onState: () => undefined,
      ctx,
    };
    await createInterviewService(deps).refreshSummary();
    expect(provider.requests).toHaveLength(0);
  });
});
