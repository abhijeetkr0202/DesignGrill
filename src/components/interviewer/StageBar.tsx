import { GROWTH_STAGES } from '@/features/design-review/stages';
import { Button } from '@/components/shared/ui';

export function StageBar({
  index,
  busy,
  onNext,
  onBack,
}: {
  index: number;
  busy: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  const current = GROWTH_STAGES[Math.min(index, GROWTH_STAGES.length - 1)]!;
  const isLast = index >= GROWTH_STAGES.length - 1;
  return (
    <section
      aria-label="Interview stage"
      className="space-y-1.5 rounded-lg border border-line bg-surface-2 p-2"
    >
      <ol className="flex gap-1" aria-label="Stages">
        {GROWTH_STAGES.map((s, i) => (
          <li
            key={s.id}
            aria-current={i === index ? 'step' : undefined}
            title={s.description}
            className={`flex-1 truncate rounded px-1.5 py-0.5 text-center text-[10px] font-medium ${
              i === index
                ? 'bg-accent text-accent-fg'
                : i < index
                  ? 'border border-accent text-accent'
                  : 'border border-line text-muted'
            }`}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>
      <p className="text-[11px] leading-snug text-muted">
        <span className="font-semibold text-fg">
          Stage {index + 1} of {GROWTH_STAGES.length}: {current.label}.
        </span>{' '}
        {current.description}
      </p>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" disabled={busy || index === 0} onClick={onBack}>
          Back
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={busy || isLast}
          title={
            isLast ? 'This is the last stage. Generate a summary when you are done.' : undefined
          }
          onClick={onNext}
        >
          Next stage
        </Button>
      </div>
    </section>
  );
}
