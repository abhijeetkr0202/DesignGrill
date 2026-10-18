import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSystemPrompt } from '@/ai/prompts';
import { Inspector } from '@/components/canvas/Inspector';
import { ChatMessage } from '@/components/interviewer/ChatMessages';
import { FindingsPanel } from '@/components/interviewer/FindingsPanel';
import { InterviewHeader } from '@/components/interviewer/InterviewHeader';
import { fromRecord, toRecord } from '@/data/repositories/types';
import { runInterviewerTurn } from '@/features/design-review/interviewer';
import { resolveRefs } from '@/features/design-review/references';
import { buildSnapshot, computeProgress } from '@/features/design-review/snapshot';
import {
  addComponent,
  addRequirement,
  addReview,
  appendMessage,
  connectComponents,
  recordAskedQuestion,
  setCoaching,
  setPhaseFloor,
} from '@/features/interview-session/commands';
import { getInterviewService } from '@/features/interview-session/ai-store';
import {
  createInterviewService,
  type InterviewDeps,
} from '@/features/interview-session/interview-service';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { MAX_ASKED_QUESTIONS, type Finding, type SessionDocument } from '@/types/session';
import { FakeProvider, loadPack, makeCtx, newDoc } from './helpers';

function design() {
  const ctx = makeCtx();
  const api = addComponent(
    newDoc(ctx),
    { type: 'service', label: 'Redirect API', position: { x: 0, y: 0 } },
    ctx,
  );
  const cache = addComponent(
    api.doc,
    { type: 'cache', label: 'Redis', position: { x: 1, y: 1 } },
    ctx,
  );
  const db = addComponent(
    cache.doc,
    { type: 'database', label: 'PostgreSQL', position: { x: 2, y: 2 } },
    ctx,
  );
  const linked = connectComponents(db.doc, { source: api.id, target: cache.id }, ctx);
  const req = addRequirement(
    linked.doc,
    { kind: 'nonFunctional', title: 'Redirect p99 under 50 ms', category: 'latency' },
    ctx,
  );
  return {
    ctx,
    doc: req.doc,
    ids: {
      api: api.id,
      cache: cache.id,
      db: db.id,
      edge: linked.id as string,
      req: req.id,
    },
  };
}

const interviewReply = (groundedIn: string[]) =>
  JSON.stringify({
    commentary: 'Looking at your cache.',
    question: { text: 'What happens on a cache miss?' },
    groundedIn,
  });

function serviceFor(
  doc: SessionDocument,
  replies: (string | Error)[],
  extra?: Partial<InterviewDeps>,
) {
  const state = { doc };
  const provider = new FakeProvider(replies);
  return loadPack().then((pack) => {
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
      ...extra,
    };
    return { service: createInterviewService(deps), state, provider };
  });
}

describe('interview phases', () => {
  it('moves forward only when the candidate chooses, and says so to the interviewer', async () => {
    const pack = await loadPack();
    const { ctx } = design();
    const doc = newDoc(ctx);
    expect(computeProgress(doc)).toMatchObject({
      suggestedPhase: 'requirements',
      candidateMovedOn: false,
    });

    const moved = setPhaseFloor(doc, 2, ctx);
    expect(computeProgress(moved)).toMatchObject({
      suggestedPhase: 'deep-dive',
      candidateMovedOn: true,
    });
    expect(setPhaseFloor(moved, 99, ctx).phaseFloor).toBe(3);
    expect(setPhaseFloor(moved, -4, ctx).phaseFloor).toBe(0);
    expect(
      buildSnapshot(moved, pack, 'architecture-interview', 'now').progress.suggestedPhase,
    ).toBe('deep-dive');
  });

  it('never goes behind what the design itself shows', () => {
    const { doc } = design();
    const withFunctional = addRequirement(doc, { kind: 'functional', title: 'Redirect' }).doc;
    const low = setPhaseFloor(withFunctional, 0);
    expect(computeProgress(low).candidateMovedOn).toBe(false);
    expect(computeProgress(low).suggestedPhase).not.toBe('requirements');
  });

  it('is shown in the panel with Move on and Undo', async () => {
    const user = userEvent.setup();
    useSessionStore.setState({ doc: newDoc() });
    render(<InterviewHeader />);
    expect(screen.getByText('Requirements').closest('li')).toHaveAttribute('aria-current', 'step');

    await user.click(screen.getByRole('button', { name: 'Move on' }));
    expect(useSessionStore.getState().doc?.phaseFloor).toBe(1);
    expect(screen.getByText('High-level design').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(useSessionStore.getState().doc?.phaseFloor).toBe(0);
  });
});

describe('interview and coaching mode', () => {
  it('starts as a strict interview and only coaches after the candidate switches', async () => {
    const user = userEvent.setup();
    const pack = await loadPack();
    const doc = newDoc();
    expect(doc.coaching).toBe(false);
    expect(buildSnapshot(doc, pack, 'architecture-interview', 'now').style).toBe('interview');
    expect(buildSystemPrompt('architecture-interview')).not.toContain('# Coaching mode');

    useSessionStore.setState({ doc });
    render(<InterviewHeader />);
    expect(screen.getByRole('button', { name: 'Interview' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Coaching' }));
    expect(useSessionStore.getState().doc?.coaching).toBe(true);

    const coaching = setCoaching(doc, true);
    expect(buildSnapshot(coaching, pack, 'architecture-interview', 'now').style).toBe('coaching');
    expect(buildSystemPrompt('architecture-interview', { coaching: true })).toContain(
      '# Coaching mode',
    );
  });

  it('sends the coaching rules and labels the reply, and keeps interview replies unlabeled', async () => {
    const { doc } = design();
    const coached = await serviceFor(setCoaching(doc, true), [interviewReply([])]);
    await coached.service.request('architecture-interview');
    expect(coached.provider.requests[0]?.system).toContain('# Coaching mode');
    expect(coached.state.doc.messages.at(-1)?.coaching).toBe(true);

    const strict = await serviceFor(doc, [interviewReply([])]);
    await strict.service.request('architecture-interview');
    expect(strict.provider.requests[0]?.system).not.toContain('# Coaching mode');
    expect(strict.state.doc.messages.at(-1)?.coaching).toBeUndefined();
  });
});

describe('question ledger', () => {
  it('remembers every question asked and tells the interviewer not to repeat them', async () => {
    const { doc } = design();
    const { service, state, provider } = await serviceFor(doc, [
      interviewReply([]),
      interviewReply([]),
    ]);
    await service.request('architecture-interview');
    expect(state.doc.questionsAsked.map((q) => q.text)).toEqual(['What happens on a cache miss?']);

    await service.request('architecture-interview');
    const second = provider.requests[1]!.messages[0]!.content;
    expect(second).toContain('questionsAlreadyAsked');
    expect(second).toContain('What happens on a cache miss?');
    expect(provider.requests[1]!.system).toContain('questionsAlreadyAsked');
  });

  it('keeps only the most recent questions', () => {
    let doc = newDoc();
    for (let i = 0; i < MAX_ASKED_QUESTIONS + 5; i++) {
      doc = recordAskedQuestion(doc, {
        id: `q${i}`,
        text: `Question ${i}`,
        mode: 'architecture-interview',
        askedAt: 'x',
      });
    }
    expect(doc.questionsAsked).toHaveLength(MAX_ASKED_QUESTIONS);
    expect(doc.questionsAsked.at(-1)?.text).toBe(`Question ${MAX_ASKED_QUESTIONS + 4}`);
  });
});

describe('links between messages and the diagram', () => {
  it('resolves names and ids, and drops anything that does not exist', () => {
    const { doc, ids } = design();
    const refs = resolveRefs(doc, [
      'redis',
      ids.api,
      'Redirect API → Redis',
      'Ghost Service',
      ids.req,
    ]);
    expect(refs.nodeIds).toEqual([ids.cache, ids.api]);
    expect(refs.edgeIds).toEqual([ids.edge]);
    expect(refs.requirementIds).toEqual([ids.req]);
  });

  it('stores only real elements on a cache question, using the actual cache node', async () => {
    const { doc, ids } = design();
    const { service, state } = await serviceFor(doc, [
      interviewReply(['Redis', 'Ghost', 'node_nope']),
    ]);
    await service.request('architecture-interview');
    expect(state.doc.messages.at(-1)?.related).toEqual({
      nodeIds: [ids.cache],
      edgeIds: [],
      requirementIds: [],
    });
  });

  it('attaches the elements a review is about, and ignores invented ids', async () => {
    const { doc, ids, ctx } = design();
    const pack = await loadPack();
    const provider = new FakeProvider([
      JSON.stringify({
        overview: 'Cache is a single point.',
        findings: [
          {
            kind: 'conditional',
            severity: 'high',
            title: 'Single cache',
            affectedNodeIds: [ids.cache, 'node_invented'],
            affectedEdgeIds: [ids.edge],
            relatedRequirementIds: [ids.req],
            reasoning: 'r',
            confidence: 'medium',
          },
        ],
      }),
    ]);
    const result = await runInterviewerTurn({
      mode: 'architecture-review',
      doc,
      pack,
      provider,
      model: 'm',
      ctx,
    });
    expect(result.related).toEqual({
      nodeIds: [ids.cache],
      edgeIds: [ids.edge],
      requirementIds: [ids.req],
    });
    expect(result.review?.droppedReferences).toBe(1);
  });

  it('carries what the candidate selected into the request and onto the reply', async () => {
    const { doc, ids } = design();
    const { service, state, provider } = await serviceFor(doc, [interviewReply([])]);
    await service.request('architecture-interview', {
      focus: { nodeIds: [ids.db, 'node_gone'], edgeIds: [] },
    });
    const sent = provider.requests[0]!.messages[0]!.content;
    expect(sent).toContain('candidateFocus');
    expect(sent).toContain('PostgreSQL');
    expect(sent).not.toContain('node_gone');
    expect(state.doc.messages.at(-1)?.related?.nodeIds).toEqual([ids.db]);
  });

  it('shows clickable references that highlight the element on the real canvas', async () => {
    const user = userEvent.setup();
    const { doc, ids } = design();
    useSessionStore.setState({ doc });
    useUiStore.getState().clearSelection();
    useUiStore.getState().setFocusNodes([]);
    render(
      <ul>
        <ChatMessage
          message={{
            id: 'm1',
            role: 'interviewer',
            content: 'Question: What if Redis is down?',
            createdAt: '2026-01-01T00:00:00.000Z',
            related: {
              nodeIds: [ids.cache, 'node_deleted'],
              edgeIds: [ids.edge],
              requirementIds: [ids.req],
            },
          }}
          outdated={false}
        />
      </ul>,
    );

    const refs = screen.getByRole('group', { name: 'Related to this message' });
    expect(within(refs).queryByText(/deleted/)).not.toBeInTheDocument();
    await user.click(within(refs).getByRole('button', { name: /^◎ Redis$/ }));
    expect(useUiStore.getState().selectedNodeIds).toEqual([ids.cache]);
    expect(useUiStore.getState().focusNodeIds).toEqual([ids.cache]);

    await user.click(within(refs).getByRole('button', { name: 'Show all' }));
    expect(useUiStore.getState().selectedNodeIds).toEqual([ids.cache]);
    expect(useUiStore.getState().selectedEdgeIds).toEqual([ids.edge]);
    expect(new Set(useUiStore.getState().focusNodeIds)).toEqual(new Set([ids.api, ids.cache]));

    await user.click(within(refs).getByRole('button', { name: /Req: Redirect p99/ }));
    expect(useUiStore.getState().leftTab).toBe('requirements');
  });

  it('lets the candidate ask about, or request a review of, the selected component', async () => {
    const user = userEvent.setup();
    const { doc, ids } = design();
    useSessionStore.setState({ doc });
    useUiStore.getState().setSelection([ids.cache], []);
    const spy = vi.spyOn(getInterviewService(), 'request').mockResolvedValue();

    render(<Inspector />);
    await user.click(screen.getByRole('button', { name: 'Ask about this' }));
    expect(spy).toHaveBeenLastCalledWith('architecture-interview', {
      focus: { nodeIds: [ids.cache], edgeIds: [] },
    });
    await user.click(screen.getByRole('button', { name: 'Review this' }));
    expect(spy).toHaveBeenLastCalledWith('architecture-review', {
      focus: { nodeIds: [ids.cache], edgeIds: [] },
    });
    expect(useUiStore.getState().rightTab).toBe('interview');
    spy.mockRestore();
  });
});

describe('findings', () => {
  function withFinding(status: Finding['status'] = 'open') {
    const { doc, ids, ctx } = design();
    const finding: Finding = {
      id: 'fnd_1',
      reviewId: 'rev_1',
      kind: 'conditional',
      severity: 'high',
      title: 'Single cache',
      affectedNodeIds: [ids.cache],
      affectedEdgeIds: [ids.edge],
      relatedRequirementIds: [ids.req],
      reasoning: 'If Redis fails every read hits the database.',
      mitigations: [],
      confidence: 'medium',
      status,
      createdAt: 'x',
    };
    const reviewed = addReview(
      doc,
      {
        id: 'rev_1',
        mode: 'architecture-review',
        overview: 'o',
        missingInformation: [],
        basedOnRevision: 0,
        createdAt: 'x',
      },
      [finding],
      ctx,
    );
    return { doc: reviewed, ids };
  }

  beforeEach(() => {
    useUiStore.getState().clearSelection();
  });

  it('can be accepted as a trade-off, asked for more information, and are not raised again', async () => {
    const user = userEvent.setup();
    const pack = await loadPack();
    const { doc } = withFinding();
    useSessionStore.setState({ doc });
    render(<FindingsPanel />);

    await user.click(screen.getByRole('button', { name: 'Needs clarification' }));
    let current = useSessionStore.getState().doc!;
    expect(current.findings[0]?.status).toBe('needs-clarification');
    let snap = buildSnapshot(current, pack, 'architecture-interview', 'now');
    expect(snap.unresolvedFindings[0]).toMatchObject({
      title: 'Single cache',
      status: 'needs-clarification',
    });
    expect(snap.acceptedTradeOffs).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Accept trade-off' }));
    current = useSessionStore.getState().doc!;
    expect(current.findings[0]?.status).toBe('accepted');
    snap = buildSnapshot(current, pack, 'architecture-interview', 'now');
    expect(snap.unresolvedFindings).toEqual([]);
    expect(snap.acceptedTradeOffs).toEqual(['Single cache']);
    expect(screen.queryByText('Single cache')).not.toBeInTheDocument();
  });

  it('marks a finding from an older review as possibly out of date', () => {
    const { doc } = withFinding();
    expect(doc.revision).toBeGreaterThan(0);
    useSessionStore.setState({ doc });
    render(<FindingsPanel />);
    expect(screen.getByText('from an earlier version')).toBeInTheDocument();
    expect(screen.getByText(/design has changed since the latest review/i)).toBeInTheDocument();
  });

  it('highlights the affected component or connection from the finding', async () => {
    const user = userEvent.setup();
    const { doc, ids } = withFinding();
    useSessionStore.setState({ doc });
    render(<FindingsPanel />);

    await user.click(screen.getByRole('button', { name: '◎ Redis' }));
    expect(useUiStore.getState().selectedNodeIds).toEqual([ids.cache]);
    await user.click(screen.getByRole('button', { name: '◎ Redirect API → Redis' }));
    expect(useUiStore.getState().selectedEdgeIds).toEqual([ids.edge]);
  });
});

describe('requests while others are running', () => {
  it('ignores a duplicate request made while one is running', async () => {
    const { doc } = design();
    const { service, provider } = await serviceFor(doc, [interviewReply([]), interviewReply([])]);
    const first = service.request('architecture-interview');
    const second = service.request('architecture-interview');
    await Promise.all([first, second]);
    expect(provider.requests).toHaveLength(1);
  });

  it('does not write a late reply into a different session', async () => {
    const { doc } = design();
    const other = { ...newDoc(makeCtx()), id: 'ses_other' };
    const state = { doc };
    const provider = new FakeProvider([interviewReply([])]);
    const original = provider.complete.bind(provider);
    provider.complete = async (...args) => {
      state.doc = other;
      return original(...args);
    };
    const pack = await loadPack();
    const service = createInterviewService({
      getDoc: () => state.doc,
      getPack: () => pack,
      update: (m) => {
        state.doc = m(state.doc);
      },
      getSettings: () => ({ provider: 'openai', model: 'm' }),
      getProvider: () => provider,
      hasKey: async () => true,
      onState: () => undefined,
    });

    await service.request('architecture-interview');
    expect(state.doc.id).toBe(other.id);
    expect(state.doc.messages).toEqual([]);
    expect(state.doc.questionsAsked).toEqual([]);
  });

  it('keeps the candidate answer and design when the provider fails, and can retry', async () => {
    const { doc } = design();
    const { service, state } = await serviceFor(
      appendMessage(doc, { role: 'interviewer', content: 'Why a cache?' }),
      [new Error('down'), JSON.stringify({ assessment: 'Fine.', followUpQuestion: null })],
    );
    await service.submitAnswer('To cut read latency.');
    expect(state.doc.messages.map((m) => m.content)).toContain('To cut read latency.');
    expect(state.doc.architecture.nodes).toHaveLength(3);

    await service.retry();
    expect(state.doc.messages.filter((m) => m.content === 'To cut read latency.')).toHaveLength(1);
    expect(state.doc.messages.at(-1)?.role).toBe('interviewer');
  });
});

describe('saved interview state', () => {
  it('survives save and resume, and defaults for sessions saved before it existed', () => {
    const { doc, ids } = design();
    let saved = setCoaching(setPhaseFloor(doc, 2), true);
    saved = recordAskedQuestion(saved, {
      id: 'q1',
      text: 'Why a cache?',
      mode: 'architecture-interview',
      askedAt: 'x',
    });
    saved = appendMessage(saved, {
      role: 'interviewer',
      content: 'About Redis',
      coaching: true,
      related: { nodeIds: [ids.cache], edgeIds: [], requirementIds: [] },
    });

    const restored = fromRecord(JSON.parse(JSON.stringify(toRecord(saved))));
    expect(restored.phaseFloor).toBe(2);
    expect(restored.coaching).toBe(true);
    expect(restored.questionsAsked.map((q) => q.text)).toEqual(['Why a cache?']);
    expect(restored.messages.at(-1)).toMatchObject({
      coaching: true,
      related: { nodeIds: [ids.cache] },
    });

    const legacy = JSON.parse(JSON.stringify(toRecord(saved)));
    for (const key of ['phaseFloor', 'questionsAsked', 'coaching']) delete legacy.meta.extra[key];
    const old = fromRecord(legacy);
    expect(old).toMatchObject({ phaseFloor: 0, questionsAsked: [], coaching: false });
  });
});
