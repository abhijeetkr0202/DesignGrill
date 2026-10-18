import { INTERVIEW_PHASES, PHASE_LABELS, phaseIndex } from '@/features/design-review/phases';
import { computeProgress } from '@/features/design-review/snapshot';
import { setCoaching, setPhaseFloor } from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { Button } from '@/components/shared/ui';

const MODES = [
  {
    coaching: false,
    label: 'Interview',
    hint: 'The interviewer asks questions and does not hand you the solution.',
  },
  {
    coaching: true,
    label: 'Coaching',
    hint: 'The interviewer explains concepts, gives hints, and compares options.',
  },
] as const;

// Shows which phase the interview is in, lets the candidate move on when they choose to, and
// switches between a strict interview and coaching. Neither ever changes without a click.
export function InterviewHeader() {
  const doc = useSessionStore((s) => s.doc);
  if (!doc) return null;
  const progress = computeProgress(doc);
  const current = phaseIndex(progress.suggestedPhase);
  const next = INTERVIEW_PHASES[current + 1];
  const apply = (mutator: Parameters<ReturnType<typeof useSessionStore.getState>['apply']>[0]) =>
    useSessionStore.getState().apply(mutator, { history: false });

  return (
    <section aria-label="Interview phase and mode" className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <div role="group" aria-label="Interview mode" className="flex rounded border border-line">
          {MODES.map((m) => (
            <button
              key={m.label}
              type="button"
              aria-pressed={doc.coaching === m.coaching}
              title={m.hint}
              onClick={() => apply((d) => setCoaching(d, m.coaching))}
              className={`px-2.5 py-0.5 text-[11px] font-medium first:rounded-l last:rounded-r ${
                doc.coaching === m.coaching
                  ? 'bg-accent text-accent-fg'
                  : 'text-muted hover:bg-surface-2'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="min-w-0 truncate text-[11px] text-muted">
          {doc.coaching ? MODES[1].hint : MODES[0].hint}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <ol className="flex min-w-0 flex-1 gap-1" aria-label="Interview phases">
          {INTERVIEW_PHASES.map((phase, i) => (
            <li
              key={phase}
              aria-current={i === current ? 'step' : undefined}
              className={`flex-1 truncate rounded px-1 py-0.5 text-center text-[10px] font-medium ${
                i === current
                  ? 'bg-accent text-accent-fg'
                  : i < current
                    ? 'border border-accent text-accent'
                    : 'border border-line text-muted'
              }`}
            >
              {PHASE_LABELS[phase]}
            </li>
          ))}
        </ol>
        {progress.candidateMovedOn && (
          <Button size="sm" variant="ghost" onClick={() => apply((d) => setPhaseFloor(d, 0))}>
            Undo
          </Button>
        )}
        {next && (
          <Button
            size="sm"
            title="Skip ahead without waiting for the interviewer to think you are ready"
            onClick={() => apply((d) => setPhaseFloor(d, current + 1))}
          >
            Move on
          </Button>
        )}
      </div>
    </section>
  );
}
