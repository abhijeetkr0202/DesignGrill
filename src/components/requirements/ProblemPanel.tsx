import { addRequirement } from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { Badge, Button, Section } from '@/components/shared/ui';

export function ProblemPanel() {
  const pack = useSessionStore((s) => s.pack);
  const requirements = useSessionStore((s) => s.doc?.requirements);
  if (!pack || !requirements) return null;
  const { problem } = pack;
  const existing = new Set(requirements.map((r) => r.title.trim().toLowerCase()));

  return (
    <div>
      <div className="border-b border-line px-3 py-3">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-sm font-semibold">{problem.title}</h2>
          <Badge>{problem.difficulty}</Badge>
        </div>
        <p className="text-xs leading-relaxed whitespace-pre-wrap">{problem.statement}</p>
      </div>

      <Section title="Where to start">
        <ul className="list-disc space-y-1 pl-4 text-xs">
          {problem.initialGuidance.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </Section>

      <Section
        title="Clarifying questions"
        count={problem.requirementQuestions.length}
        defaultOpen={false}
      >
        <p className="mb-2 text-[11px] text-muted">
          Questions an interviewer would expect you to ask. Add any as an open question to track it.
        </p>
        <ul className="space-y-2">
          {problem.requirementQuestions.map((q) => {
            const added = existing.has(q.question.trim().toLowerCase());
            return (
              <li key={q.id} className="rounded border border-line bg-surface p-2">
                <div className="mb-0.5 text-[11px] font-medium text-muted">{q.area}</div>
                <p className="text-xs">{q.question}</p>
                <Button
                  size="sm"
                  className="mt-1.5"
                  disabled={added}
                  onClick={() =>
                    useSessionStore
                      .getState()
                      .apply(
                        (d) => addRequirement(d, { kind: 'openQuestion', title: q.question }).doc,
                      )
                  }
                >
                  {added ? 'Added' : 'Add as open question'}
                </Button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Estimation prompts" defaultOpen={false}>
        <ul className="list-disc space-y-1 pl-4 text-xs">
          {problem.estimationPrompts.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted">
          Record your own numbers under Capacity estimates. Any workload figures the interviewer
          suggests are illustrative, not benchmarks.
        </p>
      </Section>
    </div>
  );
}
