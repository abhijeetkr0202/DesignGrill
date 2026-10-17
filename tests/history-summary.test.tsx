import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { HistorySummaryControl } from '@/components/interviewer/HistorySummaryControl';
import { fromRecord, toRecord } from '@/data/repositories/types';
import { KEEP_RAW, SUMMARY_TRIGGER, planFold } from '@/features/design-review/history-summary';
import { buildSnapshot } from '@/features/design-review/snapshot';
import {
  appendMessage,
  editHistorySummaryText,
  resetHistorySummary,
  setHistorySummary,
  setHistorySummaryEnabled,
} from '@/features/interview-session/commands';
import {
  createInterviewService,
  type InterviewDeps,
} from '@/features/interview-session/interview-service';
import { useSessionStore } from '@/store/session-store';
import type { SessionDocument } from '@/types/session';
import { FakeProvider, loadPack, makeCtx, newDoc } from './helpers';

function withMessages(count: number, ctx = makeCtx()) {
  let doc = newDoc(ctx);
  for (let i = 1; i <= count; i++) {
    doc = appendMessage(
      doc,
      { role: i % 2 ? 'interviewer' : 'candidate', content: `message ${i}` },
      ctx,
    );
  }
  return { doc, ctx };
}

const sentContents = (doc: SessionDocument, pack: Awaited<ReturnType<typeof loadPack>>) =>
  buildSnapshot(doc, pack, 'architecture-interview', 'now').recentMessages.map((m) => m.content);

describe('planFold', () => {
  it('waits for enough messages, then folds all but the newest ones', () => {
    expect(planFold(withMessages(SUMMARY_TRIGGER - 1).doc)).toBeNull();

    const { doc } = withMessages(SUMMARY_TRIGGER);
    const plan = planFold(doc)!;
    expect(plan.messages).toHaveLength(SUMMARY_TRIGGER - KEEP_RAW);
    expect(plan.messages.at(-1)?.content).toBe(`message ${SUMMARY_TRIGGER - KEEP_RAW}`);
    expect(plan.coversThroughMessageId).toBe(plan.messages.at(-1)?.id);
  });

  it('counts only messages after the last summarised one', () => {
    const { doc, ctx } = withMessages(SUMMARY_TRIGGER);
    const plan = planFold(doc)!;
    const summarised = setHistorySummary(
      doc,
      { text: '- s', coversThroughMessageId: plan.coversThroughMessageId },
      ctx,
    );
    expect(planFold(summarised)).toBeNull();
    const more = withMoreMessages(summarised, SUMMARY_TRIGGER - KEEP_RAW, ctx);
    expect(planFold(more)).not.toBeNull();
  });
});

function withMoreMessages(doc: SessionDocument, count: number, ctx: ReturnType<typeof makeCtx>) {
  let next = doc;
  for (let i = 0; i < count; i++) {
    next = appendMessage(next, { role: 'candidate', content: `later ${i + 1}` }, ctx);
  }
  return next;
}

describe('snapshot with summarised history', () => {
  it('is unchanged while the flag is off, even if a summary is stored', async () => {
    const pack = await loadPack();
    const { doc, ctx } = withMessages(16);
    const plan = planFold(doc)!;
    const stored = setHistorySummary(
      doc,
      { text: '- older', coversThroughMessageId: plan.coversThroughMessageId },
      ctx,
    );
    const snap = buildSnapshot(stored, pack, 'architecture-interview', 'now');
    expect(snap.conversationSummary).toBeUndefined();
    expect(snap.recentMessages).toHaveLength(14);
  });

  it('sends the summary plus only the messages after it when the flag is on', async () => {
    const pack = await loadPack();
    const { doc, ctx } = withMessages(16);
    const plan = planFold(doc)!;
    const on = setHistorySummaryEnabled(
      setHistorySummary(
        doc,
        { text: '- older topics', coversThroughMessageId: plan.coversThroughMessageId },
        ctx,
      ),
      true,
      ctx,
    );
    const snap = buildSnapshot(on, pack, 'architecture-interview', 'now');
    expect(snap.conversationSummary?.text).toBe('- older topics');
    expect(sentContents(on, pack)).toEqual(
      Array.from({ length: KEEP_RAW }, (_, i) => `message ${16 - KEEP_RAW + 1 + i}`),
    );
  });

  it('falls back to the normal window when the flag is on but no summary exists yet', async () => {
    const pack = await loadPack();
    const { doc, ctx } = withMessages(16);
    const on = setHistorySummaryEnabled(doc, true, ctx);
    const snap = buildSnapshot(on, pack, 'architecture-interview', 'now');
    expect(snap.conversationSummary).toBeUndefined();
    expect(snap.recentMessages).toHaveLength(14);
  });

  it('does not change the design revision when the summary changes', () => {
    const { doc, ctx } = withMessages(3);
    const next = setHistorySummary(
      setHistorySummaryEnabled(doc, true, ctx),
      { text: '- x', coversThroughMessageId: null },
      ctx,
    );
    expect(next.revision).toBe(doc.revision);
    expect(resetHistorySummary(next, ctx).historySummary).toMatchObject({
      enabled: true,
      text: '',
      coversThroughMessageId: null,
    });
    expect(editHistorySummaryText(next, '  - edited  ', ctx).historySummary.text).toBe('- edited');
  });
});

describe('refreshSummary', () => {
  async function setup(opts: { enabled: boolean; replies: (string | Error)[]; messages?: number }) {
    const { doc, ctx } = withMessages(opts.messages ?? SUMMARY_TRIGGER);
    const pack = await loadPack();
    const state = { doc: setHistorySummaryEnabled(doc, opts.enabled, ctx) };
    const provider = new FakeProvider(opts.replies);
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
    return { service: createInterviewService(deps), state, provider };
  }

  it('does nothing while the flag is off', async () => {
    const { service, state, provider } = await setup({ enabled: false, replies: [] });
    await service.refreshSummary();
    expect(provider.requests).toHaveLength(0);
    expect(state.doc.historySummary.text).toBe('');
  });

  it('stores a summary and the covered range once enough messages exist', async () => {
    const { service, state, provider } = await setup({
      enabled: true,
      replies: [JSON.stringify({ summary: '- asked about caching' })],
    });
    await service.refreshSummary();
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]?.messages[0]?.content).toContain('message 1');
    expect(provider.requests[0]?.messages[0]?.content).not.toContain(`message ${SUMMARY_TRIGGER}"`);
    expect(state.doc.historySummary).toMatchObject({
      enabled: true,
      text: '- asked about caching',
    });
    const covered = state.doc.messages.find(
      (m) => m.id === state.doc.historySummary.coversThroughMessageId,
    );
    expect(covered?.content).toBe(`message ${SUMMARY_TRIGGER - KEEP_RAW}`);
  });

  it('does not call the provider before the trigger and keeps working after a failure', async () => {
    const early = await setup({ enabled: true, replies: [], messages: SUMMARY_TRIGGER - 1 });
    await early.service.refreshSummary();
    expect(early.provider.requests).toHaveLength(0);

    const failing = await setup({ enabled: true, replies: [new Error('boom'), new Error('boom')] });
    await expect(failing.service.refreshSummary()).resolves.toBeUndefined();
    expect(failing.state.doc.historySummary.text).toBe('');
  });

  it('keeps the previous summary text as input when folding again', async () => {
    const { service, state, provider } = await setup({
      enabled: true,
      replies: [
        JSON.stringify({ summary: '- first' }),
        JSON.stringify({ summary: '- first and second' }),
      ],
    });
    await service.refreshSummary();
    for (let i = 0; i < SUMMARY_TRIGGER - KEEP_RAW; i++) {
      state.doc = appendMessage(state.doc, { role: 'candidate', content: `later ${i + 1}` });
    }
    await service.refreshSummary();
    expect(provider.requests[1]?.messages[0]?.content).toContain('- first');
    expect(state.doc.historySummary.text).toBe('- first and second');
  });
});

describe('persistence', () => {
  it('round-trips the summary and defaults it for sessions saved before the feature', () => {
    const { doc, ctx } = withMessages(2);
    const saved = setHistorySummary(
      setHistorySummaryEnabled(doc, true, ctx),
      { text: '- kept', coversThroughMessageId: doc.messages[0]!.id },
      ctx,
    );
    expect(fromRecord(toRecord(saved)).historySummary).toMatchObject({
      enabled: true,
      text: '- kept',
      coversThroughMessageId: doc.messages[0]!.id,
    });

    const legacy = toRecord(doc);
    delete (legacy.meta.extra as Record<string, unknown>).historySummary;
    expect(fromRecord(legacy).historySummary).toMatchObject({ enabled: false, text: '' });
  });
});

describe('HistorySummaryControl', () => {
  beforeEach(() => {
    useSessionStore.setState({ doc: newDoc(), pack: null });
  });

  it('is off by default and turns the flag on and off for the session', async () => {
    const user = userEvent.setup();
    render(<HistorySummaryControl />);
    const box = screen.getByRole('checkbox', { name: 'Use summarised history' });
    expect(box).not.toBeChecked();
    expect(screen.queryByLabelText('Chat summary')).not.toBeInTheDocument();

    await user.click(box);
    expect(useSessionStore.getState().doc?.historySummary.enabled).toBe(true);
    expect(box).toBeChecked();

    await user.click(box);
    expect(useSessionStore.getState().doc?.historySummary.enabled).toBe(false);
  });
});
