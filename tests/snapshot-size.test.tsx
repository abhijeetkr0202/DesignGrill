import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ContextSizeNotice } from '@/components/interviewer/ContextSizeNotice';
import {
  SNAPSHOT_LIMIT_CHARS,
  SNAPSHOT_WARN_CHARS,
  buildSnapshotDetailed,
} from '@/features/design-review/snapshot';
import { addRequirement, appendMessage } from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import type { SessionDocument } from '@/types/session';
import { loadPack, makeCtx, newDoc } from './helpers';

type Pack = Awaited<ReturnType<typeof loadPack>>;

function withChat(doc: SessionDocument, count: number, chars: number, ctx = makeCtx()) {
  let next = doc;
  for (let i = 0; i < count; i++) {
    next = appendMessage(
      next,
      { role: i % 2 ? 'candidate' : 'interviewer', content: 'x'.repeat(chars) },
      ctx,
    );
  }
  return next;
}

const measure = (doc: SessionDocument, pack: Pack) =>
  buildSnapshotDetailed(doc, pack, 'architecture-review', 'now');

describe('staged shrinking', () => {
  it('trims nothing while the snapshot fits', async () => {
    const pack = await loadPack();
    const built = measure(withChat(newDoc(), 3, 200), pack);
    expect(built.trimmed).toEqual([]);
    expect(built.chars).toBe(built.fullChars);
    expect(built.snapshot.trimmedForSize).toBeUndefined();
  });

  it('cuts chat first and leaves the design text whole', async () => {
    const pack = await loadPack();
    const ctx = makeCtx();
    const longDetail = 'd'.repeat(3000);
    const base = addRequirement(
      newDoc(ctx),
      { kind: 'functional', title: 'Redirect', detail: longDetail },
      ctx,
    ).doc;
    const built = measure(withChat(base, 14, 6000, ctx), pack);

    expect(built.fullChars).toBeGreaterThan(SNAPSHOT_LIMIT_CHARS);
    expect(built.chars).toBeLessThanOrEqual(SNAPSHOT_LIMIT_CHARS);
    expect(built.trimmed).toEqual(['Chat limited to the newest 6 messages']);
    expect(built.snapshot.recentMessages).toHaveLength(6);
    expect(built.snapshot.requirements.functional[0]?.detail).toBe(longDetail);
    expect(built.snapshot.trimmedForSize).toEqual(built.trimmed);
  });

  it('clips the design text only as a last resort and says so', async () => {
    const pack = await loadPack();
    const ctx = makeCtx();
    let doc = newDoc(ctx);
    for (let i = 0; i < 30; i++) {
      doc = addRequirement(
        doc,
        { kind: 'functional', title: `Req ${i}`, detail: 'd'.repeat(3000) },
        ctx,
      ).doc;
    }
    const built = measure(doc, pack);

    expect(built.trimmed).toContain('Requirement, decision and drawing text shortened');
    expect(built.trimmed).toContain('Reference notes shortened');
    expect(built.snapshot.requirements.functional[0]?.detail?.length).toBeLessThanOrEqual(400);
  });

  it('reports how close the full snapshot is to the limit without trimming', async () => {
    const pack = await loadPack();
    const baseChars = measure(newDoc(), pack).fullChars;
    const perMessage = Math.floor(
      ((SNAPSHOT_WARN_CHARS + SNAPSHOT_LIMIT_CHARS) / 2 - baseChars) / 14,
    );
    const built = measure(withChat(newDoc(), 14, perMessage - 60), pack);
    expect(built.fullChars).toBeGreaterThan(SNAPSHOT_WARN_CHARS);
    expect(built.fullChars).toBeLessThan(SNAPSHOT_LIMIT_CHARS);
    expect(built.trimmed).toEqual([]);
  });
});

describe('ContextSizeNotice', () => {
  beforeEach(() => {
    useSessionStore.setState({ doc: null, pack: null });
  });

  it('stays hidden for a small session', async () => {
    const pack = await loadPack();
    const { container } = render(<ContextSizeNotice doc={newDoc()} pack={pack} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('explains what was shortened and offers to turn on summarised history', async () => {
    const user = userEvent.setup();
    const pack = await loadPack();
    const doc = withChat(newDoc(), 14, 6000);
    useSessionStore.setState({ doc, pack });

    render(<ContextSizeNotice doc={doc} pack={pack} />);
    expect(await screen.findByText(/no longer fits in one request/i)).toBeInTheDocument();
    expect(screen.getByText(/newest 6 messages/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Turn on summarised history' }));
    expect(useSessionStore.getState().doc?.historySummary.enabled).toBe(true);
  });
});
