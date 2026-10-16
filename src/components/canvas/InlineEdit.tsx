import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

// Double-click to edit text in place. Enter or blur saves, Escape cancels.
export function InlineEdit({
  value,
  label,
  placeholder,
  className,
  onCommit,
}: {
  value: string;
  label: string;
  placeholder?: string;
  className: string;
  onCommit: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);

  const finish = (save: boolean) => {
    setEditing(false);
    if (save && draft !== value) onCommit(draft);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
  };

  if (editing) {
    return (
      <input
        ref={input}
        aria-label={label}
        value={draft}
        maxLength={300}
        placeholder={placeholder}
        // "nodrag nopan" keep React Flow from moving the node while the text is selected.
        className={`nodrag nopan nowheel relative w-full min-w-0 border-0 bg-transparent p-0 text-center ${className}`}
        // Inline so it beats the app-wide focus ring; only the caret should show.
        style={{ outline: 'none', boxShadow: 'none' }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={onKeyDown}
        onDoubleClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <div
      title="Double-click to edit"
      className={`relative cursor-text ${className}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
    >
      {value}
    </div>
  );
}
