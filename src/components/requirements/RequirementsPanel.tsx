import { useState, type ReactNode } from 'react';
import {
  addRequirement,
  removeRequirement,
  updateRequirement,
} from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import {
  NFR_CATEGORIES,
  type NfrCategory,
  type Priority,
  type Requirement,
  type RequirementKind,
} from '@/types/session';
import { CommitText, LabeledField } from '@/components/shared/CommitText';
import { Badge, Button, ConfirmDialog, Section, fieldClass } from '@/components/shared/ui';

const SECTIONS: { kind: RequirementKind; title: string; placeholder: string; hint: string }[] = [
  {
    kind: 'functional',
    title: 'Functional requirements',
    placeholder: 'What must the system do?',
    hint: 'Behaviour users or other systems rely on.',
  },
  {
    kind: 'nonFunctional',
    title: 'Non-functional requirements',
    placeholder: 'e.g. Redirect latency, availability',
    hint: 'Qualities such as latency, availability, durability, consistency. Targets can be numeric or qualitative.',
  },
  {
    kind: 'assumption',
    title: 'Assumptions',
    placeholder: 'What are you assuming to be true?',
    hint: 'Things you decided without confirmation.',
  },
  {
    kind: 'constraint',
    title: 'Constraints',
    placeholder: 'e.g. Small team, managed services only',
    hint: 'Limits on technology, budget, or time.',
  },
  {
    kind: 'estimate',
    title: 'Capacity estimates',
    placeholder: 'e.g. Peak redirects per second',
    hint: 'Back-of-envelope numbers and how you derived them.',
  },
  {
    kind: 'openQuestion',
    title: 'Open questions',
    placeholder: 'What do you still need to find out?',
    hint: 'Unknowns to clarify with the interviewer.',
  },
];

export function RequirementsPanel() {
  const requirements = useSessionStore((s) => s.doc?.requirements);
  if (!requirements) return null;
  return (
    <div>
      {SECTIONS.map((s) => {
        const items = requirements.filter((r) => r.kind === s.kind);
        return (
          <Section key={s.kind} title={s.title} count={items.length}>
            <p className="mb-2 text-[11px] text-muted">{s.hint}</p>
            <ul className="space-y-1.5">
              {items.map((r) => (
                <RequirementItem key={r.id} requirement={r} />
              ))}
            </ul>
            <AddRequirement kind={s.kind} placeholder={s.placeholder} />
          </Section>
        );
      })}
    </div>
  );
}

function AddRequirement({ kind, placeholder }: { kind: RequirementKind; placeholder: string }) {
  const [title, setTitle] = useState('');
  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    useSessionStore.getState().apply((d) => addRequirement(d, { kind, title: trimmed }).doc);
    setTitle('');
  };
  return (
    <form
      className="mt-2 flex gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        aria-label={`Add ${kind} item`}
        className={fieldClass}
        value={title}
        maxLength={300}
        placeholder={placeholder}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Button type="submit" disabled={!title.trim()}>
        Add
      </Button>
    </form>
  );
}

function RequirementItem({ requirement: r }: { requirement: Requirement }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const linkedDecisions = useSessionStore(
    (s) => s.doc?.decisions.filter((d) => d.relatedRequirementIds.includes(r.id)).length ?? 0,
  );

  const patch = (p: Partial<Requirement>) =>
    useSessionStore.getState().apply((d) => updateRequirement(d, r.id, p));
  const remove = () => useSessionStore.getState().apply((d) => removeRequirement(d, r.id));
  const needsConfirmation = Boolean(r.detail || r.notes || r.target || linkedDecisions);

  const confirmed = r.status === 'confirmed';
  return (
    <li className="rounded border border-line bg-surface">
      <div className="flex items-center gap-1 p-1">
        <button
          type="button"
          aria-pressed={confirmed}
          aria-label={confirmed ? 'Confirmed. Mark unresolved' : 'Unresolved. Mark confirmed'}
          title={confirmed ? 'Confirmed' : 'Unresolved'}
          onClick={() => patch({ status: confirmed ? 'unresolved' : 'confirmed' })}
          className={`h-5 w-5 shrink-0 rounded border text-xs ${confirmed ? 'border-ok text-ok' : 'border-line text-muted'}`}
        >
          {confirmed ? '✓' : '?'}
        </button>
        <CommitText
          label="Title"
          value={r.title}
          maxLength={300}
          onCommit={(title) => title.trim() && patch({ title: title.trim() })}
          className="border-transparent bg-transparent"
        />
        {r.priority && (
          <Badge tone={r.priority === 'high' ? 'accent' : 'neutral'}>{r.priority}</Badge>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Hide details' : 'Show details'}
          onClick={() => setOpen((o) => !o)}
          className="px-1 text-muted"
        >
          {open ? '▾' : '▸'}
        </button>
        <button
          type="button"
          aria-label={`Delete ${r.title}`}
          onClick={() => (needsConfirmation ? setConfirming(true) : remove())}
          className="px-1 text-muted hover:text-danger"
        >
          ✕
        </button>
      </div>
      {r.target && !open && <p className="px-8 pb-1 text-[11px] text-muted">Target: {r.target}</p>}
      {open && (
        <div className="grid grid-cols-2 gap-2 border-t border-line p-2">
          {r.kind === 'nonFunctional' && (
            <LabeledField label="Category">
              <select
                className={fieldClass}
                value={r.category ?? ''}
                onChange={(e) =>
                  patch({ category: (e.target.value || undefined) as NfrCategory | undefined })
                }
              >
                <option value="">Unspecified</option>
                {NFR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </LabeledField>
          )}
          {(r.kind === 'nonFunctional' || r.kind === 'estimate') && (
            <LabeledField label={r.kind === 'estimate' ? 'Value' : 'Target (optional)'}>
              <CommitText
                label="Target"
                value={r.target ?? ''}
                placeholder={r.kind === 'estimate' ? 'e.g. 12k req/s' : 'e.g. p99 < 100 ms'}
                maxLength={300}
                onCommit={(target) => patch({ target: target.trim() || undefined })}
              />
            </LabeledField>
          )}
          {r.kind !== 'openQuestion' && (
            <LabeledField label="Priority">
              <select
                className={fieldClass}
                value={r.priority ?? ''}
                onChange={(e) =>
                  patch({ priority: (e.target.value || undefined) as Priority | undefined })
                }
              >
                <option value="">None</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </LabeledField>
          )}
          <Wide>
            <LabeledField label={r.kind === 'estimate' ? 'Calculation' : 'Detail'}>
              <CommitText
                label="Detail"
                multiline
                value={r.detail ?? ''}
                maxLength={8000}
                onCommit={(detail) => patch({ detail: detail || undefined })}
              />
            </LabeledField>
          </Wide>
          <Wide>
            <LabeledField label="Notes">
              <CommitText
                label="Notes"
                multiline
                rows={2}
                value={r.notes ?? ''}
                maxLength={8000}
                onCommit={(notes) => patch({ notes: notes || undefined })}
              />
            </LabeledField>
          </Wide>
        </div>
      )}
      {confirming && (
        <ConfirmDialog
          title="Delete this item?"
          message={
            <>
              &ldquo;{r.title}&rdquo; will be removed.
              {linkedDecisions > 0 &&
                ` ${linkedDecisions} linked design decision(s) will be marked for re-evaluation.`}{' '}
              You can undo this from the toolbar.
            </>
          }
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            remove();
          }}
        />
      )}
    </li>
  );
}

function Wide({ children }: { children: ReactNode }) {
  return <div className="col-span-2">{children}</div>;
}
