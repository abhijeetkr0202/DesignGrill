import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { fieldClass } from './ui';

interface CommitProps {
  value: string;
  onCommit: (value: string) => void;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
}

// Edits stay local until blur or Enter, so each committed change is one undo step and one autosave.
export function CommitText({
  value,
  onCommit,
  label,
  placeholder,
  multiline,
  rows = 3,
  maxLength,
  className = '',
}: CommitProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  if (multiline) {
    return (
      <textarea
        aria-label={label}
        className={`${fieldClass} resize-y ${className}`}
        rows={rows}
        value={draft}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
    );
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      setDraft(value);
      e.currentTarget.blur();
    }
  };
  return (
    <input
      aria-label={label}
      className={`${fieldClass} ${className}`}
      value={draft}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

export function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
