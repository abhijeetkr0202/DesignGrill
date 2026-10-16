import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react';

interface SplitterProps {
  // 'left' resizes the panel to the left of the handle, 'right' the panel to its right.
  side: 'left' | 'right';
  width: number;
  min: number;
  max: number;
  onChange: (width: number) => void;
  label: string;
}

export function Splitter({ side, width, min, max, onChange, label }: SplitterProps) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const clamp = useCallback((w: number) => Math.min(max, Math.max(min, w)), [min, max]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, width };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const delta = e.clientX - start.current.x;
    onChange(clamp(start.current.width + (side === 'left' ? delta : -delta)));
  };
  const onPointerUp = () => {
    start.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === 'ArrowLeft') onChange(clamp(width + (side === 'left' ? -step : step)));
    if (e.key === 'ArrowRight') onChange(clamp(width + (side === 'left' ? step : -step)));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      className="w-1 shrink-0 cursor-col-resize bg-line hover:bg-accent focus-visible:bg-accent"
    />
  );
}
