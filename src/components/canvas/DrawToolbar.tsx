import { useEffect } from 'react';
import { DRAW_TOOLS } from '@/features/architecture/draw-tools';
import { updateDrawings } from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { DrawingShape } from './DrawingShape';
import { StylePicker } from './StylePicker';

const SAMPLE_POINTS: [number, number][] = [
  [0, 0.8],
  [0.25, 0.2],
  [0.5, 0.8],
  [0.75, 0.2],
  [1, 0.8],
];

function ToolIcon({ kind }: { kind: (typeof DRAW_TOOLS)[number]['kind'] }) {
  if (kind === 'text') {
    return (
      <span aria-hidden className="w-5 text-center text-[13px] font-semibold">
        T
      </span>
    );
  }
  return (
    <span aria-hidden className="relative block h-3.5 w-5">
      <DrawingShape
        drawing={{
          kind,
          stroke: 'auto',
          fill: 'none',
          strokeWidth: 1.5,
          dashed: false,
          flipX: false,
          flipY: true,
          points: SAMPLE_POINTS,
        }}
        width={20}
        height={14}
      />
    </span>
  );
}

export function DrawToolbar() {
  const tool = useUiStore((s) => s.drawTool);
  const style = useUiStore((s) => s.drawStyle);
  const selectedIds = useUiStore((s) => s.selectedNodeIds);
  const drawings = useSessionStore((s) => s.doc?.architecture.drawings);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useUiStore.getState().setDrawTool('select');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selected = (drawings ?? []).filter((d) => selectedIds.includes(d.id));
  const shown = selected[0] ?? style;

  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line bg-surface px-2 py-1.5"
    >
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          aria-label="Select tool"
          aria-pressed={tool === 'select'}
          title="Select (Esc)"
          onClick={() => useUiStore.getState().setDrawTool('select')}
          className={`rounded border px-2 py-0.5 text-xs ${tool === 'select' ? 'border-accent text-accent' : 'border-line'}`}
        >
          Select
        </button>
        {DRAW_TOOLS.map((t) => (
          <button
            key={t.kind}
            type="button"
            aria-label={t.label}
            aria-pressed={tool === t.kind}
            title={t.label}
            onClick={() => useUiStore.getState().setDrawTool(t.kind)}
            className={`flex items-center rounded border px-1.5 py-0.5 ${tool === t.kind ? 'border-accent text-accent' : 'border-line'}`}
          >
            <ToolIcon kind={t.kind} />
          </button>
        ))}
      </div>
      <StylePicker
        value={{
          stroke: shown.stroke,
          fill: shown.fill,
          strokeWidth: shown.strokeWidth,
          dashed: shown.dashed,
        }}
        onChange={(patch) => {
          useUiStore.getState().setDrawStyle(patch);
          if (selected.length > 0) {
            const ids = selected.map((d) => d.id);
            useSessionStore.getState().apply((doc) => updateDrawings(doc, ids, patch));
          }
        }}
      />
    </div>
  );
}
