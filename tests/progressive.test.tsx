import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSystemPrompt } from '@/ai/prompts';
import { StageBar } from '@/components/interviewer/StageBar';
import { SettingsView } from '@/components/settings/SettingsView';
import { fromRecord, toRecord } from '@/data/repositories/types';
import { setRepositoriesForTesting } from '@/data/repositories';
import {
  MemoryPreferenceRepository,
  MemorySessionRepository,
} from '@/data/repositories/memory-repository';
import { buildSnapshot } from '@/features/design-review/snapshot';
import { GROWTH_STAGES, stageAt } from '@/features/design-review/stages';
import { markStageIntroduced, setGrowthStage } from '@/features/interview-session/commands';
import {
  createInterviewService,
  type InterviewDeps,
} from '@/features/interview-session/interview-service';
import { useSettingsStore } from '@/features/settings/settings-store';
import type { SessionDocument } from '@/types/session';
import { FakeProvider, loadPack, makeCtx, newDoc } from './helpers';

describe('stages and commands', () => {
  it('defines four stages and clamps lookups', () => {
    expect(GROWTH_STAGES).toHaveLength(4);
    expect(stageAt(-3).id).toBe('baseline');
    expect(stageAt(99).id).toBe(GROWTH_STAGES.at(-1)?.id);
  });

  it('changes stage without touching the design revision, and re-arms the introduction', () => {
    const ctx = makeCtx();
    const doc = newDoc(ctx);
    expect(doc.growthStage).toEqual({ index: 0, introduced: false });

    const introduced = markStageIntroduced(doc, ctx);
    expect(introduced.growthStage.introduced).toBe(true);
    expect(markStageIntroduced(introduced, ctx)).toBe(introduced);

    const next = setGrowthStage(introduced, 1, ctx);
    expect(next.growthStage).toEqual({ index: 1, introduced: false });
    expect(next.revision).toBe(doc.revision);
    expect(setGrowthStage(next, 1, ctx)).toBe(next);
    expect(setGrowthStage(next, 99, ctx).growthStage.index).toBe(GROWTH_STAGES.length - 1);
    expect(setGrowthStage(next, -5, ctx).growthStage.index).toBe(0);
  });

  it('is saved with the session and defaults for sessions saved before the feature', () => {
    const ctx = makeCtx();
    const doc = setGrowthStage(newDoc(ctx), 2, ctx);
    expect(fromRecord(toRecord(doc)).growthStage).toEqual({ index: 2, introduced: false });

    const legacy = toRecord(doc);
    delete (legacy.meta.extra as Record<string, unknown>).growthStage;
    expect(fromRecord(legacy).growthStage).toEqual({ index: 0, introduced: false });
  });
});

describe('snapshot and prompt', () => {
  it('adds the stage only in progressive mode and tracks whether it was announced', async () => {
    const pack = await loadPack();
    const ctx = makeCtx();
    const doc = newDoc(ctx);

    expect(buildSnapshot(doc, pack, 'architecture-interview', 'now').stage).toBeUndefined();

    const first = buildSnapshot(doc, pack, 'architecture-interview', 'now', {
      progressive: true,
    }).stage;
    expect(first).toMatchObject({
      number: 1,
      of: 4,
      id: 'baseline',
      justEntered: true,
      next: 'Growth',
    });

    const announced = buildSnapshot(
      markStageIntroduced(doc, ctx),
      pack,
      'architecture-review',
      'now',
      {
        progressive: true,
      },
    ).stage;
    expect(announced?.justEntered).toBe(false);

    const last = buildSnapshot(setGrowthStage(doc, 3, ctx), pack, 'architecture-review', 'now', {
      progressive: true,
    }).stage;
    expect(last).toMatchObject({ number: 4, next: null, justEntered: true });
  });

  it('adds the progressive rules to every task only when enabled', () => {
    for (const task of [
      'architecture-interview',
      'architecture-review',
      'failure-scenario',
    ] as const) {
      expect(buildSystemPrompt(task, { progressive: true })).toContain('# Progressive interview');
      expect(buildSystemPrompt(task)).not.toContain('# Progressive interview');
      expect(buildSystemPrompt(task, { progressive: false })).not.toContain(
        '# Progressive interview',
      );
    }
    expect(buildSystemPrompt('architecture-interview', { progressive: true })).toMatch(
      /simplest design/,
    );
  });
});

describe('interview service in progressive mode', () => {
  const reply = JSON.stringify({
    commentary: 'Welcome to stage one.',
    question: { text: 'What breaks first?' },
  });

  async function setup(progressive: boolean | undefined) {
    const ctx = makeCtx();
    const pack = await loadPack();
    const state = { doc: newDoc(ctx) as SessionDocument };
    const provider = new FakeProvider([reply, reply]);
    const deps: InterviewDeps = {
      getDoc: () => state.doc,
      getPack: () => pack,
      update: (m) => {
        state.doc = m(state.doc);
      },
      getSettings: () => ({ provider: 'openai', model: 'm', progressive }),
      getProvider: () => provider,
      hasKey: async () => true,
      onState: () => undefined,
      ctx,
    };
    return { service: createInterviewService(deps), state, provider };
  }

  it('sends the stage and rules, then marks the stage as announced', async () => {
    const { service, state, provider } = await setup(true);
    await service.request('architecture-interview');

    const sent = provider.requests[0]!;
    expect(sent.system).toContain('# Progressive interview');
    expect(sent.messages[0]?.content).toContain('"justEntered": true');
    expect(state.doc.growthStage.introduced).toBe(true);

    await service.request('architecture-interview');
    expect(provider.requests[1]?.messages[0]?.content).toContain('"justEntered": false');
  });

  it('announces again after the stage is advanced', async () => {
    const { service, state, provider } = await setup(true);
    await service.request('architecture-interview');
    state.doc = setGrowthStage(state.doc, 1);
    await service.request('architecture-interview');
    expect(provider.requests[1]?.messages[0]?.content).toContain('"id": "growth"');
    expect(provider.requests[1]?.messages[0]?.content).toContain('"justEntered": true');
  });

  it('keeps the free-form interview when the mode is off', async () => {
    const { service, state, provider } = await setup(false);
    await service.request('architecture-interview');
    expect(provider.requests[0]?.system).not.toContain('# Progressive interview');
    expect(provider.requests[0]?.messages[0]?.content).not.toContain('"stage"');
    expect(state.doc.growthStage.introduced).toBe(false);
  });
});

describe('progressive setting', () => {
  beforeEach(() => {
    setRepositoriesForTesting({
      sessions: new MemorySessionRepository(),
      preferences: new MemoryPreferenceRepository(),
      durable: true,
    });
    useSettingsStore.setState({ progressive: true });
  });

  it('is on by default, can be opted out of, and is remembered', async () => {
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().progressive).toBe(true);

    await useSettingsStore.getState().setProgressive(false);
    expect(useSettingsStore.getState().progressive).toBe(false);

    useSettingsStore.setState({ progressive: true });
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().progressive).toBe(false);

    await useSettingsStore.getState().setProgressive(true);
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().progressive).toBe(true);
  });

  it('is explained in Settings and can be switched off there', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    const box = screen.getByRole('checkbox', { name: /Progressive interview/ });
    expect(box).toBeChecked();
    expect(screen.getByText(/simplest design that meets your requirements/)).toBeInTheDocument();
    expect(screen.getByText(/free-form interview/)).toBeInTheDocument();

    await user.click(box);
    expect(useSettingsStore.getState().progressive).toBe(false);
    expect(box).not.toBeChecked();
  });
});

describe('StageBar', () => {
  it('shows the current stage and moves between stages', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const onBack = vi.fn();
    render(<StageBar index={1} busy={false} onNext={onNext} onBack={onBack} />);

    expect(screen.getByText(/Stage 2 of 4: Growth/)).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('2. Growth');

    await user.click(screen.getByRole('button', { name: 'Next stage' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('disables Back on the first stage, Next on the last, and both while the AI is working', () => {
    const noop = () => undefined;
    const { rerender } = render(<StageBar index={0} busy={false} onNext={noop} onBack={noop} />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next stage' })).toBeEnabled();

    rerender(<StageBar index={3} busy={false} onNext={noop} onBack={noop} />);
    expect(screen.getByRole('button', { name: 'Next stage' })).toBeDisabled();

    rerender(<StageBar index={1} busy onNext={noop} onBack={noop} />);
    expect(screen.getByRole('button', { name: 'Next stage' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });
});
