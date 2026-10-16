import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryPreferenceRepository,
  MemorySessionRepository,
} from '@/data/repositories/memory-repository';
import { setRepositoriesForTesting } from '@/data/repositories';
import {
  addRequirement,
  renameSession,
  setProblemStatement,
} from '@/features/interview-session/commands';
import {
  deleteSession,
  resumeSession,
  startCustomSession,
  startSession,
} from '@/features/interview-session/session-service';
import { buildSnapshot } from '@/features/design-review/snapshot';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { loadPack, newDoc } from './helpers';

let sessions: MemorySessionRepository;

beforeEach(() => {
  vi.useFakeTimers();
  sessions = new MemorySessionRepository();
  setRepositoriesForTesting({
    sessions,
    preferences: new MemoryPreferenceRepository(),
    durable: true,
  });
  useSessionStore.setState({
    doc: null,
    pack: null,
    undoStack: [],
    redoStack: [],
    saveStatus: 'idle',
  });
});

afterEach(() => {
  vi.useRealTimers();
  setRepositoriesForTesting(null);
});

const add = (title: string) =>
  useSessionStore.getState().apply((d) => addRequirement(d, { kind: 'functional', title }).doc);

describe('session store', () => {
  it('supports undo and redo of design edits', async () => {
    const pack = await loadPack();
    useSessionStore.getState().open(newDoc(), pack);
    add('A');
    add('B');
    expect(useSessionStore.getState().doc?.requirements).toHaveLength(2);
    useSessionStore.getState().undo();
    expect(useSessionStore.getState().doc?.requirements.map((r) => r.title)).toEqual(['A']);
    useSessionStore.getState().redo();
    expect(useSessionStore.getState().doc?.requirements).toHaveLength(2);
    useSessionStore.getState().undo();
    add('C');
    expect(useSessionStore.getState().redoStack).toHaveLength(0);
  });

  it('autosaves after a debounce and reports status', async () => {
    const pack = await loadPack();
    const doc = newDoc();
    useSessionStore.getState().open(doc, pack);
    add('A');
    expect(useSessionStore.getState().saveStatus).toBe('dirty');
    await vi.advanceTimersByTimeAsync(1000);
    expect(useSessionStore.getState().saveStatus).toBe('saved');
    expect((await sessions.load(doc.id)).requirements).toHaveLength(1);
  });

  it('keeps edits in memory when saving fails and recovers on retry', async () => {
    const pack = await loadPack();
    const doc = newDoc();
    useSessionStore.getState().open(doc, pack);
    sessions.failNextSave = new Error('disk full');
    add('A');
    await vi.advanceTimersByTimeAsync(1000);
    expect(useSessionStore.getState()).toMatchObject({
      saveStatus: 'error',
      saveError: 'disk full',
    });
    expect(useSessionStore.getState().doc?.requirements).toHaveLength(1);
    await useSessionStore.getState().save();
    expect(useSessionStore.getState().saveStatus).toBe('saved');
    expect((await sessions.load(doc.id)).requirements).toHaveLength(1);
  });

  it('flushes unsaved edits when closing', async () => {
    const pack = await loadPack();
    const doc = newDoc();
    useSessionStore.getState().open(doc, pack);
    add('A');
    await useSessionStore.getState().close();
    expect((await sessions.load(doc.id)).requirements).toHaveLength(1);
  });
});

describe('session lifecycle', () => {
  it('starts, persists, restarts and resumes a session without losing the design', async () => {
    const started = await startSession('url-shortener');
    expect(useUiStore.getState().view).toBe('workspace');
    add('Redirect short links');
    await useSessionStore.getState().save();

    // Simulate an app restart: in-memory state is gone, only the repository remains.
    useSessionStore.setState({ doc: null, pack: null, undoStack: [], redoStack: [] });
    const resumed = await resumeSession(started.id);
    expect(resumed.requirements.map((r) => r.title)).toEqual(['Redirect short links']);
    expect(useSessionStore.getState().pack?.problem.id).toBe('url-shortener');
    expect(sessions.problems.get('url-shortener')?.title).toBe('URL Shortener');
  });

  it('deletes a session and does not resurrect it through a pending autosave', async () => {
    const started = await startSession('url-shortener');
    add('Pending edit');
    await deleteSession(started.id);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await sessions.list()).toHaveLength(0);
    expect(useSessionStore.getState().doc).toBeNull();
  });

  it('reports a missing or invalid problem pack instead of crashing', async () => {
    await expect(startSession('does-not-exist')).rejects.toThrow(/problem\.json is missing/);
  });
});

describe('custom problems', () => {
  it('creates a blank canvas under the user-chosen name and resumes it after a restart', async () => {
    const started = await startCustomSession({
      title: '  Ride-sharing dispatch ',
      statement: 'Match riders with drivers.',
    });
    expect(started).toMatchObject({
      title: 'Ride-sharing dispatch',
      problemId: 'custom',
      problemStatement: 'Match riders with drivers.',
    });
    expect(started.architecture.nodes).toHaveLength(0);
    expect(sessions.problems.size).toBe(0);

    add('Match within 5 seconds');
    useSessionStore.getState().apply((d) => setProblemStatement(d, 'Updated statement'));
    useSessionStore.getState().apply((d) => renameSession(d, 'Dispatch v2'), { history: false });
    await useSessionStore.getState().save();

    useSessionStore.setState({ doc: null, pack: null, undoStack: [], redoStack: [] });
    const resumed = await resumeSession(started.id);
    expect(resumed).toMatchObject({ title: 'Dispatch v2', problemStatement: 'Updated statement' });
    expect(resumed.requirements).toHaveLength(1);
    expect((await sessions.list()).map((s) => s.title)).toEqual(['Dispatch v2']);
  });

  it('requires a name', async () => {
    await expect(startCustomSession({ title: '   ' })).rejects.toThrow(/name/);
  });

  it("sends the user's own title and statement to the interviewer, with no reference solution", async () => {
    const doc = await startCustomSession({ title: 'Chat app', statement: 'Real-time messaging.' });
    const snap = buildSnapshot(doc, useSessionStore.getState().pack!, 'architecture-review', 'now');
    expect(snap.problem).toMatchObject({ title: 'Chat app', statement: 'Real-time messaging.' });
    expect(snap.referenceMaterial).toMatch(/custom problem/);
    expect(snap.referenceMaterial).not.toMatch(/Valid alternative architectures/);
  });
});
