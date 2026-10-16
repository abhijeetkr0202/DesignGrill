import { getInterviewService, useAiStore } from '@/features/interview-session/ai-store';
import { useSessionStore } from '@/store/session-store';
import { Button, Notice, Spinner } from '@/components/shared/ui';

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-3">
      <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h4>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
        {items.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </section>
  );
}

export function SummaryPanel() {
  const summaries = useSessionStore((s) => s.doc?.summaries);
  const revision = useSessionStore((s) => s.doc?.revision ?? 0);
  const ai = useAiStore((s) => s.state);
  if (!summaries) return null;
  const latest = summaries[summaries.length - 1];
  const running = ai.status === 'running' && ai.mode === 'session-summary';

  return (
    <div className="p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          A structured recap of requirements, design, decisions, risks, and what to practise next.
        </p>
        <Button
          size="sm"
          variant="primary"
          disabled={ai.status === 'running'}
          onClick={() => void getInterviewService().request('session-summary')}
        >
          {latest ? 'Regenerate' : 'Generate summary'}
        </Button>
      </div>
      {running && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Spinner /> Writing summary…
        </div>
      )}
      {!latest && !running && <p className="p-2 text-xs text-muted">No summary yet.</p>}
      {latest && (
        <div>
          {latest.basedOnRevision < revision && (
            <Notice tone="warn">The design changed after this summary was generated.</Notice>
          )}
          <p className="mt-2 text-xs whitespace-pre-wrap">{latest.architectureOverview}</p>
          <List title="Requirements understood" items={latest.requirementsUnderstood} />
          {latest.keyDecisions.length > 0 && (
            <section className="mt-3">
              <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">
                Key decisions
              </h4>
              <ul className="mt-1 space-y-1 text-xs">
                {latest.keyDecisions.map((d, i) => (
                  <li key={i}>
                    <span className="font-semibold">{d.decision}</span>: {d.rationale}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <List title="Strengths" items={latest.strengths} />
          <List title="Risks" items={latest.risks} />
          <List title="Suggested improvements" items={latest.improvements} />
          <List title="Trade-offs" items={latest.tradeoffs} />
          <List title="Unresolved questions" items={latest.unresolvedQuestions} />
          <List title="Topics for further practice" items={latest.practiceTopics} />
          {latest.rubric.length > 0 && (
            <section className="mt-3">
              <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">
                Rubric (0 to 4)
              </h4>
              <table className="mt-1 w-full text-xs">
                <tbody>
                  {latest.rubric.map((r) => (
                    <tr key={r.criterion} className="border-t border-line align-top">
                      <th scope="row" className="py-1 pr-2 text-left font-medium">
                        {r.criterion}
                      </th>
                      <td className="py-1 pr-2 font-mono">{r.score}/4</td>
                      <td className="py-1 text-muted">{r.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[11px] text-muted">
                Scores are a practice aid based only on this session, using the documented rubric in
                src/ai/prompts/scoring-rubric.md. Different valid designs can score equally well.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
