import { getRepositories, type SessionRepository } from '@/data/repositories';
import { buildCustomPack, CUSTOM_PROBLEM_ID } from '@/features/problem-library/custom';
import { loadProblemPack } from '@/features/problem-library/loader';
import type { ProblemPack } from '@/features/problem-library/schema';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import type { SessionDocument, SessionMeta } from '@/types/session';
import { createSession } from './commands';
import { useAiStore } from './ai-store';

export async function startSession(problemId: string): Promise<SessionDocument> {
  const pack = await loadProblemPack(problemId);
  const repo = getRepositories().sessions;
  await repo.upsertProblem({
    id: pack.problem.id,
    version: pack.problem.version,
    title: pack.problem.title,
  });
  const doc = createSession({
    problemId: pack.problem.id,
    problemVersion: pack.problem.version,
    title: pack.problem.title,
  });
  await repo.save(doc);
  await enter(doc, pack);
  return doc;
}

export async function startCustomSession(input: {
  title: string;
  statement?: string;
}): Promise<SessionDocument> {
  const title = input.title.trim().slice(0, 300);
  if (!title) throw new Error('Give your session a name.');
  const doc = createSession({
    problemId: CUSTOM_PROBLEM_ID,
    problemVersion: 1,
    title,
    problemStatement: input.statement?.trim().slice(0, 8000) ?? '',
  });
  await getRepositories().sessions.save(doc);
  await enter(doc, buildCustomPack(title));
  return doc;
}

export async function resumeSession(id: string): Promise<SessionDocument> {
  const doc = await getRepositories().sessions.load(id);
  const pack =
    doc.problemId === CUSTOM_PROBLEM_ID
      ? buildCustomPack(doc.title)
      : await loadProblemPack(doc.problemId);
  await enter(doc, pack);
  return doc;
}

async function enter(doc: SessionDocument, pack: ProblemPack): Promise<void> {
  await useSessionStore.getState().close();
  useAiStore.getState().set({ status: 'idle' });
  useSessionStore.getState().open(doc, pack);
  useUiStore.getState().clearSelection();
  useUiStore.getState().setView('workspace');
  await getRepositories()
    .preferences.set('lastSessionId', doc.id)
    .catch(() => undefined);
}

export async function leaveSession(): Promise<void> {
  await useSessionStore.getState().close();
  useUiStore.getState().setView('library');
}

export async function listSessions(
  repo: SessionRepository = getRepositories().sessions,
): Promise<SessionMeta[]> {
  return repo.list();
}

export async function deleteSession(id: string): Promise<void> {
  const current = useSessionStore.getState().doc;
  if (current?.id === id) {
    // Drop in-memory state first so a pending autosave cannot resurrect the deleted session.
    useSessionStore.setState({ doc: null, pack: null, saveStatus: 'idle' });
    useUiStore.getState().setView('library');
  }
  await getRepositories().sessions.delete(id);
  const prefs = await getRepositories()
    .preferences.list()
    .catch(() => ({}) as Record<string, string>);
  if (prefs.lastSessionId === id) await getRepositories().preferences.set('lastSessionId', null);
}
