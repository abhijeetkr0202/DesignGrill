import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatMessage } from '@/components/interviewer/ChatMessages';
import { buildIdNames, humanizeDeep, humanizeIds } from '@/features/design-review/humanize-ids';
import { runInterviewerTurn } from '@/features/design-review/interviewer';
import {
  addComponent,
  addRequirement,
  connectComponents,
} from '@/features/interview-session/commands';
import { FakeProvider, loadPack, makeCtx, newDoc } from './helpers';

const HEX = 'a1b2c3d4e5f60718';

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
  const linked = connectComponents(cache.doc, { source: api.id, target: cache.id }, ctx);
  const req = addRequirement(
    linked.doc,
    { kind: 'nonFunctional', title: 'Redirect p99 under 50 ms', category: 'latency' },
    ctx,
  );
  return { ctx, doc: req.doc, api: api.id, cache: cache.id, edge: linked.id, req: req.id };
}

describe('humanizeIds', () => {
  it('drops a parenthetical that only holds ids, since the sentence already names the thing', () => {
    const { doc, req, api } = design();
    const names = buildIdNames(doc);
    expect(humanizeIds(`The latency requirement (${req}) is unclear.`, names)).toBe(
      'The latency requirement is unclear.',
    );
    expect(humanizeIds(`The service (${api}, ${req}) is fine.`, names)).toBe(
      'The service is fine.',
    );
    expect(humanizeIds(`See the cache [node_${HEX}] below.`, names)).toBe('See the cache below.');
  });

  it('replaces ids inside a sentence with the name', () => {
    const { doc, api, cache, edge, req } = design();
    const names = buildIdNames(doc);
    expect(humanizeIds(`${api} depends on ${cache} to meet ${req}.`, names)).toBe(
      'Redirect API depends on Redis to meet Redirect p99 under 50 ms.',
    );
    expect(humanizeIds(`Look at ${edge}.`, names)).toBe('Look at Redirect API → Redis.');
  });

  it('leaves ordinary text and unknown bare words alone', () => {
    const { doc } = design();
    const names = buildIdNames(doc);
    const text = 'Keep node_modules out of the image (see the docs) and use req_per_second.';
    expect(humanizeIds(text, names)).toBe(text);
    expect(humanizeIds('Plain sentence.', names)).toBe('Plain sentence.');
  });

  it('removes parentheticals with made-up but id-shaped values', () => {
    const { doc } = design();
    expect(humanizeIds(`The queue (req_${HEX}) is slow.`, buildIdNames(doc))).toBe(
      'The queue is slow.',
    );
  });

  it('rewrites text deeply without touching id fields passed separately', () => {
    const { doc, req } = design();
    const names = buildIdNames(doc);
    const cleaned = humanizeDeep(
      { overview: `Check (${req}).`, items: [`Also ${req}`], nested: { text: `(${req})` } },
      names,
    );
    expect(cleaned).toEqual({
      overview: 'Check.',
      items: ['Also Redirect p99 under 50 ms'],
      nested: { text: '' },
    });
  });
});

describe('interviewer replies', () => {
  it('never show internal ids in the chat, the question, or the findings', async () => {
    const { doc, ctx, api, req } = design();
    const pack = await loadPack();
    const provider = new FakeProvider([
      JSON.stringify({
        overview: `Latency (${req}) depends on the API.`,
        findings: [
          {
            kind: 'conditional',
            severity: 'high',
            title: `Cache is a single point (${api})`,
            affectedNodeIds: [api],
            relatedRequirementIds: [req],
            reasoning: `It threatens ${req} if it fails.`,
            mitigations: [{ description: `Add a replica to ${api}`, tradeoffs: `Cost (${api})` }],
            confidence: 'medium',
          },
        ],
        missingInformation: [`Traffic for ${api} (${req})`],
        followUpQuestion: { text: `How does ${api} fail over (${req})?` },
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

    expect(result.content).not.toMatch(/_[0-9a-z]*\)|req_|node_/);
    expect(result.content).toContain('Latency depends on the API.');
    expect(result.pendingQuestion?.text).toBe('How does Redirect API fail over?');
    const finding = result.review!.findings[0]!;
    expect(finding.title).toBe('Cache is a single point');
    expect(finding.reasoning).toBe('It threatens Redirect p99 under 50 ms if it fails.');
    expect(finding.mitigations[0]).toEqual({
      description: 'Add a replica to Redirect API',
      tradeoffs: 'Cost',
    });
    // Id fields keep their ids so the diagram can still highlight the affected component.
    expect(finding.affectedNodeIds).toEqual([api]);
    expect(finding.relatedRequirementIds).toEqual([req]);
    expect(result.review!.review.missingInformation).toEqual(['Traffic for Redirect API']);
  });
});

describe('chat display', () => {
  it('hides ids in older stored replies', () => {
    const { doc, req } = design();
    const names = buildIdNames(doc);
    render(
      <ul>
        <ChatMessage
          message={{
            id: 'm1',
            role: 'interviewer',
            content: `Is the target (${req}) realistic?`,
            createdAt: '2026-01-01T00:00:00.000Z',
          }}
          outdated={false}
          humanize={(t) => humanizeIds(t, names)}
        />
      </ul>,
    );
    expect(screen.getByText('Is the target realistic?')).toBeInTheDocument();
    expect(screen.queryByText(/req_/)).not.toBeInTheDocument();
  });
});
