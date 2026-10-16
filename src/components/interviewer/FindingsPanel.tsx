import { useState } from 'react';
import { setFindingStatus } from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import type { Finding, Severity } from '@/types/session';
import { Badge, Button } from '@/components/shared/ui';

const ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
const TONE: Record<Severity, 'danger' | 'warn' | 'accent' | 'neutral'> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warn',
  low: 'neutral',
  info: 'neutral',
};

export function FindingsPanel() {
  const doc = useSessionStore((s) => s.doc);
  const [showClosed, setShowClosed] = useState(false);
  if (!doc) return null;

  const visible = doc.findings
    .filter((f) => showClosed || f.status === 'open')
    .sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
  const latestReview = doc.reviews[doc.reviews.length - 1];

  return (
    <div className="p-2">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-muted">
          {latestReview
            ? latestReview.basedOnRevision < doc.revision
              ? 'The design has changed since the latest review.'
              : 'Latest review matches your current design.'
            : 'No review yet.'}
        </span>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
          />
          Show resolved
        </label>
      </div>
      {latestReview && (
        <p className="mb-3 rounded border border-line bg-surface p-2 text-xs whitespace-pre-wrap">
          {latestReview.overview}
        </p>
      )}
      {visible.length === 0 && (
        <p className="p-2 text-xs text-muted">
          Findings from architecture reviews appear here. Run &ldquo;Review architecture&rdquo; in
          the Interview tab.
        </p>
      )}
      <ul className="space-y-2">
        {visible.map((f) => (
          <FindingCard key={f.id} finding={f} />
        ))}
      </ul>
    </div>
  );
}

function FindingCard({ finding: f }: { finding: Finding }) {
  const nodes = useSessionStore((s) => s.doc?.architecture.nodes);
  const requirements = useSessionStore((s) => s.doc?.requirements);
  const closed = f.status !== 'open';
  const set = (status: Finding['status']) =>
    useSessionStore.getState().apply((d) => setFindingStatus(d, f.id, status), { history: false });
  const labelOf = (id: string) => nodes?.find((n) => n.id === id)?.label ?? 'removed component';
  const reqOf = (id: string) =>
    requirements?.find((r) => r.id === id)?.title ?? 'removed requirement';

  return (
    <li className={`rounded border border-line bg-surface p-2 ${closed ? 'opacity-60' : ''}`}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <Badge tone={f.kind === 'strength' ? 'ok' : TONE[f.severity]}>{f.severity}</Badge>
        <Badge>{f.kind}</Badge>
        <Badge title="How sure the interviewer is">{f.confidence} confidence</Badge>
        {closed && <Badge>{f.status}</Badge>}
      </div>
      <h4 className="text-[13px] font-semibold">{f.title}</h4>
      {(f.affectedNodeIds.length > 0 || f.relatedRequirementIds.length > 0) && (
        <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
          {f.affectedNodeIds.map((id) => (
            <button
              key={id}
              type="button"
              className="rounded border border-line px-1.5 py-px hover:bg-surface-2"
              onClick={() => {
                useUiStore.getState().setSelection([id], []);
                useUiStore.getState().setFocusNodes([id]);
                setTimeout(() => useUiStore.getState().setFocusNodes([]), 2500);
              }}
            >
              ◎ {labelOf(id)}
            </button>
          ))}
          {f.relatedRequirementIds.map((id) => (
            <span key={id} className="rounded border border-line px-1.5 py-px text-muted">
              Req: {reqOf(id)}
            </span>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-xs whitespace-pre-wrap">{f.reasoning}</p>
      {f.conditions && <Detail label="Occurs when" text={f.conditions} />}
      {f.impact && <Detail label="Likely impact" text={f.impact} />}
      {f.mitigations.length > 0 && (
        <div className="mt-1.5 text-xs">
          <span className="font-semibold">Options</span>
          <ul className="list-disc pl-4">
            {f.mitigations.map((m, i) => (
              <li key={i}>
                {m.description}
                {m.tradeoffs && <span className="text-muted"> Trade-off: {m.tradeoffs}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-2 flex gap-1.5">
        {closed ? (
          <Button size="sm" onClick={() => set('open')}>
            Reopen
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={() => set('resolved')}>
              Mark resolved
            </Button>
            <Button size="sm" variant="ghost" onClick={() => set('dismissed')}>
              Dismiss
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <p className="mt-1 text-xs">
      <span className="font-semibold">{label}: </span>
      {text}
    </p>
  );
}
