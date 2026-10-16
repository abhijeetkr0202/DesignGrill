import type { PointerEvent } from 'react';
import { useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { buildDrawing, type DrawStyle, type Point } from '@/features/architecture/drawing-geometry';
import type { DrawingInput } from '@/features/interview-session/commands';
import type { DrawingKind } from '@/types/session';
import { DrawingShape } from './DrawingShape';

interface Gesture {
  startScreen: Point;
  currentScreen: Point;
  screenPath: Point[];
  path: Point[];
}

// Captures a drag over the canvas and turns it into a drawing in flow coordinates.
export function DrawOverlay({
  kind,
  style,
  onCreate,
}: {
  kind: DrawingKind;
  style: DrawStyle;
  onCreate: (input: DrawingInput) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const ref = useRef<HTMLDivElement>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);

  const local = (e: PointerEvent): Point => {
    const box = ref.current?.getBoundingClientRect();
    return { x: e.clientX - (box?.left ?? 0), y: e.clientY - (box?.top ?? 0) };
  };
  const flow = (e: PointerEvent): Point => screenToFlowPosition({ x: e.clientX, y: e.clientY });

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = local(e);
    setGesture({ startScreen: p, currentScreen: p, screenPath: [p], path: [flow(e)] });
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    setGesture((g) => {
      if (!g) return g;
      const p = local(e);
      return {
        ...g,
        currentScreen: p,
        screenPath: kind === 'freehand' ? [...g.screenPath, p] : g.screenPath,
        path: kind === 'freehand' ? [...g.path, flow(e)] : g.path,
      };
    });
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!gesture) return;
    const start = gesture.path[0] ?? flow(e);
    const input = buildDrawing(kind, start, flow(e), [...gesture.path, flow(e)], style);
    setGesture(null);
    onCreate(kind === 'text' ? { ...input, text: 'Text' } : input);
  };

  const g = gesture;
  const left = g ? Math.min(g.startScreen.x, g.currentScreen.x) : 0;
  const top = g ? Math.min(g.startScreen.y, g.currentScreen.y) : 0;
  const width = g ? Math.max(Math.abs(g.currentScreen.x - g.startScreen.x), 2) : 0;
  const height = g ? Math.max(Math.abs(g.currentScreen.y - g.startScreen.y), 2) : 0;

  return (
    <div
      ref={ref}
      data-testid="draw-overlay"
      aria-label="Drawing area: drag to draw"
      className="absolute inset-0 z-20 cursor-crosshair"
      style={{ touchAction: 'none' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => setGesture(null)}
    >
      {g && kind !== 'freehand' && (
        <div className="absolute" style={{ left, top, width, height }}>
          <DrawingShape
            drawing={{
              ...style,
              kind: kind === 'text' ? 'rectangle' : kind,
              dashed: kind === 'text' ? true : style.dashed,
              fill: kind === 'text' ? 'none' : style.fill,
              flipX: g.currentScreen.x < g.startScreen.x,
              flipY: g.currentScreen.y < g.startScreen.y,
            }}
            width={width}
            height={height}
          />
        </div>
      )}
      {g && kind === 'freehand' && (
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full"
          style={{ pointerEvents: 'none' }}
        >
          <polyline
            fill="none"
            stroke={style.stroke === 'auto' ? 'var(--fg)' : style.stroke}
            strokeWidth={style.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={g.screenPath.map((p) => `${p.x},${p.y}`).join(' ')}
          />
        </svg>
      )}
    </div>
  );
}
