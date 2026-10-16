import { describe, expect, it } from 'vitest';
import { AIError } from '@/ai/errors';
import {
  createInterviewService,
  type AiRequestState,
  type InterviewDeps,
} from '@/features/interview-session/interview-service';
import { computeChanges } from '@/features/design-review/changes';
import { addComponent } from '@/features/interview-session/commands';
import type { SessionDocument } from '@/types/session';
import { FakeProvider, loadPack, makeCtx, newDoc } from './helpers';

async function setup(replies: (string | Error)[], opts: { hasKey?: boolean } = {}) {
  const ctx = makeCtx();
  const pack = await loadPack();
  const state = {
    doc: addComponent(newDoc(ctx), { type: 'service', position: { x: 0, y: 0 } }, ctx)
      .doc as SessionDocument,
  };
  const states: AiRequestState[] = [];
  const provider = new FakeProvider(replies);
  const deps: InterviewDeps = {
    getDoc: () => state.doc,
    getPack: () => pack,
    update: (m) => {
      state.doc = m(state.doc);
    },
    getSettings: () => ({ provider: 'openai', model: 'm' }),
    getProvider: () => provider,
    hasKey: async () => opts.hasKey ?? true,
    onState: (s) => states.push(s),
    ctx,
  };
  return { service: createInterviewService(deps), state, states, provider, ctx };
}

const reviewJson = JSON.stringify({
  overview: 'Looks thin.',
  findings: [
    {
      kind: 'question',
      severity: 'info',
      title: 'Scale?',
      reasoning: 'unknown',
      confidence: 'low',
    },
  ],
  followUpQuestion: { text: 'What is peak traffic?' },
});

describe('interview service', () => {
  it('runs a review, records findings, a pending question and a baseline', async () => {
    const { service, state, states } = await setup([reviewJson]);
    await service.request('architecture-review');
    expect(states.map((s) => s.status)).toEqual(['running', 'idle']);
    expect(state.doc.reviews).toHaveLength(1);
    expect(state.doc.findings).toHaveLength(1);
    expect(state.doc.pendingQuestion?.text).toBe('What is peak traffic?');
    expect(state.doc.messages.at(-1)).toMatchObject({
      role: 'interviewer',
      mode: 'architecture-review',
    });
    expect(state.doc.reviewBaseline).not.toBeNull();
    expect(computeChanges(state.doc).entries).toHaveLength(0);
  });

  it('fails clearly without a key and does not call the provider', async () => {
    const { service, states, provider } = await setup([], { hasKey: false });
    await service.request('architecture-review');
    expect(provider.requests).toHaveLength(0);
    expect(states.at(-1)).toMatchObject({ status: 'error', error: { kind: 'missing-key' } });
    expect(states.at(-1)?.error?.message).toMatch(/Settings/);
  });

  it('keeps the candidate answer and design when the provider fails, then retries without duplicating it', async () => {
    const { service, state, states } = await setup([
      new AIError('timeout'),
      JSON.stringify({ assessment: 'Fine.', followUpQuestion: null }),
    ]);
    await service.submitAnswer('My answer');
    expect(states.at(-1)).toMatchObject({ status: 'error', error: { kind: 'timeout' } });
    expect(state.doc.messages.filter((m) => m.role === 'candidate')).toHaveLength(1);
    expect(state.doc.architecture.nodes).toHaveLength(1);

    await service.retry();
    expect(states.at(-1)?.status).toBe('idle');
    expect(state.doc.messages.filter((m) => m.role === 'candidate')).toHaveLength(1);
    expect(state.doc.messages.at(-1)?.role).toBe('interviewer');
  });

  it('reports malformed model output without touching the design', async () => {
    const { service, state, states } = await setup(['garbage', 'still garbage']);
    const before = state.doc.architecture;
    await service.request('architecture-review');
    expect(states.at(-1)).toMatchObject({ status: 'error', error: { kind: 'malformed-response' } });
    expect(state.doc.architecture).toBe(before);
    expect(state.doc.findings).toHaveLength(0);
  });

  it('marks the reply as based on the revision it saw when the design changes mid-request', async () => {
    const { service, state, provider, ctx } = await setup([reviewJson]);
    const started = state.doc.revision;
    const complete = provider.complete.bind(provider);
    // An edit lands while the request is in flight.
    provider.complete = async (req, options) => {
      state.doc = addComponent(state.doc, { type: 'cache', position: { x: 5, y: 5 } }, ctx).doc;
      return complete(req, options);
    };
    await service.request('architecture-review');
    expect(state.doc.messages.at(-1)?.basedOnRevision).toBe(started);
    expect(state.doc.revision).toBeGreaterThan(started);
    expect(state.doc.architecture.nodes).toHaveLength(2);
    // The baseline is the reviewed design, so the mid-flight edit still shows as a change.
    expect(computeChanges(state.doc).entries.map((e) => e.kind)).toEqual(['added']);
  });

  it('ignores empty answers', async () => {
    const { service, provider } = await setup([]);
    await service.submitAnswer('   ');
    expect(provider.requests).toHaveLength(0);
  });
});
