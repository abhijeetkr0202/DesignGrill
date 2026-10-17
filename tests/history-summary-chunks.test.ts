import { describe, expect, it } from 'vitest';
import {
  foldHistory,
  planFold,
  summaryTargetWords,
} from '@/features/design-review/history-summary';
import { appendMessage, setHistorySummaryEnabled } from '@/features/interview-session/commands';
import {
  createInterviewService,
  type InterviewDeps,
} from '@/features/interview-session/interview-service';
import type { Message, SessionDocument } from '@/types/session';
import { FakeProvider, loadPack, makeCtx, newDoc } from './helpers';

const reply = (summary: string) => JSON.stringify({ summary });

function messages(sizes: number[]): Message[] {
  const ctx = makeCtx();
  let doc = newDoc(ctx);
  sizes.forEach((n, i) => {
    doc = appendMessage(
      doc,
      { role: i % 2 ? 'candidate' : 'interviewer', content: 'x'.repeat(n) },
      ctx,
    );
  });
  return doc.messages;
}

const base = (provider: FakeProvider, msgs: Message[]) => ({
  provider,
  model: 'm',
  previousSummary: '',
  messages: msgs,
  targetWords: 250,
});

const xCount = (provider: FakeProvider) =>
  provider.requests.reduce((n, r) => n + (r.messages[0]?.content.match(/x/g)?.length ?? 0), 0);

describe('summaryTargetWords', () => {
  it('starts at 250, grows with the chat, and stops at the cap', () => {
    expect(summaryTargetWords(0)).toBe(250);
    expect(summaryTargetWords(9)).toBe(250);
    expect(summaryTargetWords(10)).toBe(350);
    expect(summaryTargetWords(30)).toBe(550);
    expect(summaryTargetWords(500)).toBe(900);
  });

  it('puts the target into the instructions sent to the model', async () => {
    const provider = new FakeProvider([reply('- a')]);
    await foldHistory({ ...base(provider, messages([100])), targetWords: 450 });
    expect(provider.requests[0]?.system).toContain('about 450 words');
    expect(provider.requests[0]?.system).not.toContain('{{TARGET_WORDS}}');
  });
});

describe('folding long messages in pieces', () => {
  it('sends every character of a very long message instead of clipping it', async () => {
    const provider = new FakeProvider([reply('- part one'), reply('- all four parts')]);
    const result = await foldHistory(base(provider, messages([20_000])));

    expect(provider.requests).toHaveLength(2);
    expect(xCount(provider)).toBe(20_000);
    expect(provider.requests[0]?.messages[0]?.content).toContain('"part": "1/4"');
    // The first batch's summary is carried into the second call.
    expect(provider.requests[1]?.messages[0]?.content).toContain('- part one');
    expect(result).toEqual({ summary: '- all four parts', foldedMessages: 1 });
  });

  it('keeps several short messages in one call', async () => {
    const provider = new FakeProvider([reply('- short')]);
    const result = await foldHistory(base(provider, messages([500, 500, 500])));
    expect(provider.requests).toHaveLength(1);
    expect(result.foldedMessages).toBe(3);
  });

  it('keeps the progress already made when a later batch fails', async () => {
    // Three 5,000 character messages: two fit in the first batch, the third needs a second one.
    const provider = new FakeProvider([
      reply('- first batch'),
      new Error('down'),
      new Error('down'),
    ]);
    const result = await foldHistory(base(provider, messages([5000, 5000, 5000])));
    expect(result).toEqual({ summary: '- first batch', foldedMessages: 2 });
  });

  it('fails when nothing could be folded', async () => {
    const provider = new FakeProvider([new Error('down'), new Error('down')]);
    await expect(foldHistory(base(provider, messages([100])))).rejects.toThrow();
  });

  it('limits how many calls one fold can make', async () => {
    const provider = new FakeProvider(
      Array.from({ length: 6 }, (_, i) => reply(`- batch ${i + 1}`)),
    );
    const result = await foldHistory(base(provider, messages(Array(8).fill(11_000))));
    expect(provider.requests).toHaveLength(6);
    expect(result).toEqual({ summary: '- batch 6', foldedMessages: 6 });
  });
});

describe('refreshSummary with a partial fold', () => {
  it('moves the covered pointer only as far as messages were fully folded', async () => {
    const ctx = makeCtx();
    let doc = setHistorySummaryEnabled(newDoc(ctx), true, ctx);
    for (let i = 1; i <= 14; i++) {
      doc = appendMessage(doc, { role: 'candidate', content: 'y'.repeat(7000) }, ctx);
    }
    const plan = planFold(doc)!;
    expect(plan.messages).toHaveLength(10);

    const state = { doc: doc as SessionDocument };
    const provider = new FakeProvider(
      Array.from({ length: 6 }, (_, i) => reply(`- batch ${i + 1}`)),
    );
    const pack = await loadPack();
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

    expect(provider.requests).toHaveLength(6);
    expect(state.doc.historySummary.text).toBe('- batch 6');
    expect(state.doc.historySummary.coversThroughMessageId).toBe(plan.messages[5]!.id);
  });
});
