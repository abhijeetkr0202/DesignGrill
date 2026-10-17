import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { InterviewerPanel } from '@/components/interviewer/InterviewerPanel';
import {
  addRequirement,
  appendMessage,
  clearChat,
  markStageIntroduced,
  setGrowthStage,
  setHistorySummary,
  setHistorySummaryEnabled,
  setPendingQuestion,
} from '@/features/interview-session/commands';
import { useAiStore } from '@/features/interview-session/ai-store';
import { useSessionStore } from '@/store/session-store';
import type { SessionDocument } from '@/types/session';
import { loadPack, makeCtx, newDoc } from './helpers';

function chattedDoc() {
  const ctx = makeCtx();
  let doc = addRequirement(newDoc(ctx), { kind: 'functional', title: 'Redirect links' }, ctx).doc;
  doc = appendMessage(doc, { role: 'interviewer', content: 'What is your read load?' }, ctx);
  doc = appendMessage(doc, { role: 'candidate', content: 'About 10k per second.' }, ctx);
  doc = setPendingQuestion(
    doc,
    {
      id: 'q1',
      text: 'What is your read load?',
      mode: 'architecture-interview',
      askedAt: 'x',
      basedOnRevision: 0,
    },
    ctx,
  );
  doc = setHistorySummaryEnabled(
    setHistorySummary(
      doc,
      { text: '- asked about load', coversThroughMessageId: doc.messages[0]!.id },
      ctx,
    ),
    true,
    ctx,
  );
  doc = markStageIntroduced(setGrowthStage(doc, 2, ctx), ctx);
  return { doc, ctx };
}

describe('clearChat', () => {
  it('removes the conversation but keeps the design, the stage and the summary setting', () => {
    const { doc, ctx } = chattedDoc();
    const cleared = clearChat(doc, ctx);

    expect(cleared.messages).toEqual([]);
    expect(cleared.pendingQuestion).toBeNull();
    expect(cleared.historySummary).toMatchObject({
      enabled: true,
      text: '',
      coversThroughMessageId: null,
    });
    expect(cleared.requirements).toEqual(doc.requirements);
    expect(cleared.growthStage).toEqual({ index: 2, introduced: false });
    expect(cleared.revision).toBe(doc.revision);
  });

  it('does nothing when there is no conversation', () => {
    const doc = newDoc();
    expect(clearChat(doc)).toBe(doc);
  });
});

describe('Clear chat button', () => {
  beforeEach(async () => {
    useAiStore.getState().set({ status: 'idle' });
    useSessionStore.setState({ doc: null, pack: await loadPack() });
  });

  it('asks first, then empties the chat and leaves the design alone', async () => {
    const user = userEvent.setup();
    const { doc } = chattedDoc();
    useSessionStore.setState({ doc });
    render(<InterviewerPanel />);
    expect(screen.getByText('About 10k per second.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear chat' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Clear the chat?' });
    expect(useSessionStore.getState().doc?.messages).toHaveLength(2);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(useSessionStore.getState().doc?.messages).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Clear chat' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Clear chat' }),
    );

    const after = useSessionStore.getState().doc as SessionDocument;
    expect(after.messages).toEqual([]);
    expect(after.pendingQuestion).toBeNull();
    expect(after.requirements).toHaveLength(1);
    expect(screen.queryByText('About 10k per second.')).not.toBeInTheDocument();
    expect(screen.getByText(/I am your interviewer/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear chat' })).toBeDisabled();
  });

  it('is disabled while there is nothing to clear', () => {
    useSessionStore.setState({ doc: newDoc() });
    render(<InterviewerPanel />);
    expect(screen.getByRole('button', { name: 'Clear chat' })).toBeDisabled();
  });
});
