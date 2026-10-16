import { useEffect, useRef, type ReactNode } from 'react';

export interface MenuItem {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

export const MOD_KEY =
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform)
    ? '\u2318'
    : 'Ctrl+';

export function ContextMenu({
  x,
  y,
  label,
  items,
  onClose,
}: {
  x: number;
  y: number;
  label: string;
  items: MenuItem[];
  onClose: () => void;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const move = (dir: 1 | -1) => {
    const buttons = [
      ...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
    ];
    if (buttons.length === 0) return;
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(i + dir + buttons.length) % buttons.length]?.focus();
  };

  // Keep the menu on screen near the window edges.
  const left = Math.min(x, window.innerWidth - 210);
  const top = Math.min(y, window.innerHeight - (items.length * 28 + 16));

  return (
    <div
      className="fixed inset-0 z-40"
      onPointerDown={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        className="absolute w-52 rounded-md border border-line bg-surface py-1 shadow-xl"
        style={{ left, top }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            move(1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            move(-1);
          }
        }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            className={`flex w-full items-center justify-between px-3 py-1 text-left text-xs hover:bg-surface-2 focus-visible:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 ${
              item.danger ? 'text-danger' : 'text-fg'
            }`}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="text-muted">{item.shortcut}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
