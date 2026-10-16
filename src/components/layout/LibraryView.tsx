import { useCallback, useEffect, useState } from 'react';
import { listProblems, type ProblemListing } from '@/features/problem-library/loader';
import {
  deleteSession,
  listSessions,
  resumeSession,
  startCustomSession,
  startSession,
} from '@/features/interview-session/session-service';
import { CUSTOM_PROBLEM_ID } from '@/features/problem-library/custom';
import { getRepositories } from '@/data/repositories';
import { useUiStore } from '@/store/ui-store';
import type { SessionMeta } from '@/types/session';
import { Badge, Button, ConfirmDialog, Notice, Spinner, fieldClass } from '@/components/shared/ui';

export function LibraryView() {
  const [problems, setProblems] = useState<ProblemListing[] | null>(null);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SessionMeta | null>(null);
  const [customName, setCustomName] = useState('');
  const [customStatement, setCustomStatement] = useState('');

  const refresh = useCallback(async () => {
    try {
      setSessions(await listSessions());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load saved sessions');
    }
  }, []);

  useEffect(() => {
    void listProblems().then(setProblems);
    void refresh();
  }, [refresh]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto px-6 py-8">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Design<span className="text-accent">Grill</span>
          </h1>
          <p className="text-xs text-muted">
            Your architecture. Under pressure. Practice system design with an AI interviewer that
            reads your actual design.
          </p>
        </div>
        <Button size="sm" onClick={() => useUiStore.getState().setView('settings')}>
          Settings
        </Button>
      </header>

      {!getRepositories().durable && (
        <div className="mb-4">
          <Notice tone="warn">
            Browser preview: sessions are kept in memory only. Use the desktop app to save your
            work.
          </Notice>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      <section aria-labelledby="problems-heading" className="mb-8">
        <h2
          id="problems-heading"
          className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase"
        >
          Choose a problem
        </h2>
        {!problems && <Spinner label="Loading problems" />}
        <ul className="grid gap-3 sm:grid-cols-2">
          {problems?.map((p) => (
            <li key={p.id} className="flex flex-col rounded-lg border border-line bg-surface p-3">
              {p.problem ? (
                <>
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold">{p.problem.title}</h3>
                    <Badge>{p.problem.difficulty}</Badge>
                  </div>
                  <p className="mb-2 flex-1 text-xs text-muted">{p.problem.summary}</p>
                  <div className="mb-3 flex flex-wrap gap-1">
                    {p.problem.tags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                  <Button
                    variant="primary"
                    disabled={busy !== null}
                    onClick={() => void run(`start-${p.id}`, () => startSession(p.id))}
                  >
                    {busy === `start-${p.id}` ? 'Starting…' : 'Start practice'}
                  </Button>
                </>
              ) : (
                <Notice tone="danger">
                  Problem pack &ldquo;{p.id}&rdquo; cannot be used. {p.error}
                </Notice>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="custom-heading" className="mb-8">
        <h2
          id="custom-heading"
          className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase"
        >
          Or start with a blank canvas
        </h2>
        <form
          className="space-y-2 rounded-lg border border-line bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!customName.trim()) return;
            void run('start-custom', () =>
              startCustomSession({ title: customName, statement: customStatement }),
            );
          }}
        >
          <p className="text-xs text-muted">
            Design any system of your own. You write the problem and requirements; the interviewer
            judges your design against them.
          </p>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-muted">Session name</span>
            <input
              className={fieldClass}
              value={customName}
              maxLength={300}
              placeholder="e.g. Ride-sharing dispatch"
              onChange={(e) => setCustomName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-muted">
              Problem statement (optional, editable later)
            </span>
            <textarea
              className={fieldClass}
              rows={3}
              value={customStatement}
              maxLength={8000}
              onChange={(e) => setCustomStatement(e.target.value)}
            />
          </label>
          <Button type="submit" variant="primary" disabled={busy !== null || !customName.trim()}>
            {busy === 'start-custom' ? 'Creating…' : 'Create blank canvas'}
          </Button>
        </form>
      </section>

      <section aria-labelledby="sessions-heading">
        <h2
          id="sessions-heading"
          className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase"
        >
          Saved sessions
        </h2>
        {sessions.length === 0 && <p className="text-xs text-muted">No saved sessions yet.</p>}
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded border border-line bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium">{s.title}</span>
                  {s.problemId === CUSTOM_PROBLEM_ID && <Badge>custom</Badge>}
                </div>
                <div className="text-[11px] text-muted">
                  Updated {new Date(s.updatedAt).toLocaleString()} ·{' '}
                  {s.status === 'completed' ? 'Completed' : 'In progress'}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy !== null}
                  onClick={() => void run(`resume-${s.id}`, () => resumeSession(s.id))}
                >
                  Resume
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy !== null}
                  onClick={() => setDeleting(s)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {deleting && (
        <ConfirmDialog
          title="Delete this session?"
          message="The requirements, architecture, decisions, and conversation of this session will be permanently removed from this device. This cannot be undone."
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const target = deleting;
            setDeleting(null);
            void run(`delete-${target.id}`, async () => {
              await deleteSession(target.id);
              await refresh();
              setBusy(null);
            });
          }}
        />
      )}
    </div>
  );
}
