import { useState } from 'react';
import {
  recordDecision,
  removeDecision,
  updateDecision,
} from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import type { Decision } from '@/types/session';
import { CommitText, LabeledField } from '@/components/shared/CommitText';
import { Badge, Button, ConfirmDialog, fieldClass } from '@/components/shared/ui';

export function DecisionsPanel() {
  const decisions = useSessionStore((s) => s.doc?.decisions);
  const [adding, setAdding] = useState(false);
  if (!decisions) return null;
  const flagged = decisions.filter((d) => d.status === 'needs-reevaluation').length;

  return (
    <div className="p-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-muted">
          Record why you chose something. Link decisions to components and requirements; if a linked
          requirement changes, the decision is flagged for re-evaluation.
        </p>
        <Button size="sm" onClick={() => setAdding((a) => !a)}>
          {adding ? 'Close' : 'Add decision'}
        </Button>
      </div>
      {flagged > 0 && (
        <p className="mb-2 rounded border border-warn p-2 text-xs">
          {flagged} decision{flagged === 1 ? ' needs' : 's need'} re-evaluation because related
          requirements or components changed.
        </p>
      )}
      {adding && <NewDecision onDone={() => setAdding(false)} />}
      <ul className="space-y-2">
        {decisions.map((d) => (
          <DecisionCard key={d.id} decision={d} />
        ))}
      </ul>
      {decisions.length === 0 && !adding && (
        <p className="p-2 text-xs text-muted">No decisions recorded yet.</p>
      )}
    </div>
  );
}

function NewDecision({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [rationale, setRationale] = useState('');
  return (
    <form
      className="mb-3 space-y-2 rounded border border-line bg-surface p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        useSessionStore
          .getState()
          .apply(
            (d) => recordDecision(d, { title: title.trim(), rationale: rationale.trim() }).doc,
          );
        onDone();
      }}
    >
      <LabeledField label="Decision">
        <input
          className={fieldClass}
          value={title}
          maxLength={300}
          placeholder="e.g. Use a key-value store for the mapping"
          onChange={(e) => setTitle(e.target.value)}
        />
      </LabeledField>
      <LabeledField label="Rationale">
        <textarea
          className={fieldClass}
          rows={3}
          value={rationale}
          maxLength={8000}
          onChange={(e) => setRationale(e.target.value)}
        />
      </LabeledField>
      <Button type="submit" variant="primary" disabled={!title.trim()}>
        Save decision
      </Button>
    </form>
  );
}

function DecisionCard({ decision: d }: { decision: Decision }) {
  const nodes = useSessionStore((s) => s.doc?.architecture.nodes);
  const requirements = useSessionStore((s) => s.doc?.requirements);
  const [confirming, setConfirming] = useState(false);
  const patch = (p: Partial<Decision>) =>
    useSessionStore.getState().apply((doc) => updateDecision(doc, d.id, p));
  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <li
      className={`rounded border bg-surface p-2 ${d.status === 'needs-reevaluation' ? 'border-warn' : 'border-line'}`}
    >
      <div className="mb-1 flex items-center gap-2">
        <CommitText
          label="Decision title"
          value={d.title}
          onCommit={(v) => v.trim() && patch({ title: v.trim() })}
        />
        {d.status === 'needs-reevaluation' && <Badge tone="warn">re-evaluate</Badge>}
        <button
          type="button"
          aria-label={`Delete decision ${d.title}`}
          className="px-1 text-muted hover:text-danger"
          onClick={() => setConfirming(true)}
        >
          ✕
        </button>
      </div>
      {d.reevaluationReason && <p className="mb-1 text-[11px] text-warn">{d.reevaluationReason}</p>}
      <LabeledField label="Rationale">
        <CommitText
          label="Rationale"
          multiline
          value={d.rationale}
          onCommit={(v) => patch({ rationale: v })}
        />
      </LabeledField>
      <div className="mt-1.5">
        <LabeledField label="Alternatives considered">
          <CommitText
            label="Alternatives"
            multiline
            rows={2}
            value={d.alternatives ?? ''}
            onCommit={(v) => patch({ alternatives: v || undefined })}
          />
        </LabeledField>
      </div>
      <LinkPicker
        label="Related components"
        items={(nodes ?? []).map((n) => ({ id: n.id, label: n.label }))}
        selected={d.relatedNodeIds}
        onToggle={(id) => patch({ relatedNodeIds: toggle(d.relatedNodeIds, id) })}
      />
      <LinkPicker
        label="Related requirements"
        items={(requirements ?? [])
          .filter((r) => r.kind !== 'openQuestion')
          .map((r) => ({ id: r.id, label: r.title }))}
        selected={d.relatedRequirementIds}
        onToggle={(id) => patch({ relatedRequirementIds: toggle(d.relatedRequirementIds, id) })}
      />
      {d.status === 'needs-reevaluation' && (
        <Button size="sm" className="mt-2" onClick={() => patch({ status: 'active' })}>
          Mark re-evaluated
        </Button>
      )}
      {confirming && (
        <ConfirmDialog
          title="Delete this decision?"
          message={
            <>&ldquo;{d.title}&rdquo; will be removed. You can undo this from the toolbar.</>
          }
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            useSessionStore.getState().apply((doc) => removeDecision(doc, d.id));
          }}
        />
      )}
    </li>
  );
}

function LinkPicker({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <fieldset className="mt-1.5">
      <legend className="mb-0.5 text-[11px] font-medium text-muted">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {items.map((i) => (
          <label
            key={i.id}
            className={`cursor-pointer rounded border px-1.5 py-px text-[11px] ${selected.includes(i.id) ? 'border-accent text-accent' : 'border-line text-muted'}`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={selected.includes(i.id)}
              onChange={() => onToggle(i.id)}
            />
            {i.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
