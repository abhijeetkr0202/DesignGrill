import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90 border-transparent',
  secondary: 'bg-surface-2 text-fg hover:bg-line border-line',
  ghost: 'bg-transparent text-fg hover:bg-surface-2 border-transparent',
  danger: 'bg-transparent text-danger hover:bg-surface-2 border-line',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ComponentPropsWithRef<'button'> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded border font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5 text-[13px]'
      } ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export const fieldClass =
  'w-full rounded border border-line bg-surface px-2 py-1 text-[13px] text-fg placeholder:text-muted';

export function Badge({
  tone = 'neutral',
  children,
  title,
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent';
  children: ReactNode;
  title?: string;
}) {
  const tones = {
    neutral: 'border-line text-muted',
    ok: 'border-ok text-ok',
    warn: 'border-warn text-warn',
    danger: 'border-danger text-danger',
    accent: 'border-accent text-accent',
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded border px-1.5 py-px text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ label = 'Working' }: { label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent"
    />
  );
}

export function Notice({
  tone = 'neutral',
  children,
  action,
}: {
  tone?: 'neutral' | 'warn' | 'danger';
  children: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    neutral: 'border-line bg-surface-2',
    warn: 'border-warn bg-surface-2',
    danger: 'border-danger bg-surface-2',
  };
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex items-start justify-between gap-2 rounded border px-2.5 py-2 text-xs ${tones[tone]}`}
    >
      <div className="min-w-0">{children}</div>
      {action}
    </div>
  );
}

export function Section({
  title,
  count,
  defaultOpen = true,
  actions,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section aria-label={title} className="border-b border-line">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase"
        >
          <span aria-hidden>{open ? '▾' : '▸'}</span>
          {title}
          {count !== undefined && <span className="font-normal">({count})</span>}
        </button>
        {actions}
      </div>
      {open && (
        <div id={id} className="px-3 pb-3">
          {children}
        </div>
      )}
    </section>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-[min(420px,90vw)] rounded-lg border border-line bg-surface p-4 shadow-xl"
      >
        <h2 id="confirm-title" className="mb-1 text-sm font-semibold">
          {title}
        </h2>
        <div className="mb-4 text-xs text-muted">{message}</div>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button ref={confirmRef} variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
