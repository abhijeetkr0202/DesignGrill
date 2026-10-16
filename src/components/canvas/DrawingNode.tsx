import { NodeResizer, type NodeProps } from '@xyflow/react';
import { memo, useEffect, useRef, useState } from 'react';
import { MIN_SIZE } from '@/features/architecture/drawing-geometry';
import type { DrawingFlowNode } from '@/features/architecture/flow-adapter';
import { removeDrawings, updateDrawings } from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import type { Drawing } from '@/types/session';
import { DrawingShape, textLayout } from './DrawingShape';

const canHoldText = (d: Drawing) =>
  d.kind !== 'line' && d.kind !== 'arrow' && d.kind !== 'freehand';

// Enter adds a line break; Ctrl/Cmd+Enter or clicking away saves; Escape cancels.
function TextEditor({ drawing: d }: { drawing: Drawing }) {
  const [draft, setDraft] = useState(d.text ?? '');
  const ref = useRef<HTMLTextAreaElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const finish = () => {
    useUiStore.getState().setEditingDrawing(null);
    if (cancelled.current) {
      // A note that was never written is discarded rather than left empty.
      if (d.kind === 'text' && !d.text) {
        useSessionStore.getState().apply((doc) => removeDrawings(doc, [d.id]));
      }
      return;
    }
    const text = draft.trim();
    if (d.kind === 'text' && !text) {
      useSessionStore.getState().apply((doc) => removeDrawings(doc, [d.id]));
      useUiStore.getState().clearSelection();
    } else if (text !== (d.text ?? '')) {
      useSessionStore
        .getState()
        .apply((doc) => updateDrawings(doc, [d.id], { text: text || undefined }));
    }
  };

  return (
    <textarea
      ref={ref}
      aria-label="Drawing text"
      value={draft}
      maxLength={2000}
      // "nodrag nopan nowheel" keep React Flow from moving or panning while typing.
      className={`nodrag nopan nowheel absolute inset-0 flex h-full w-full resize-none border-0 bg-transparent px-1 text-[16px] leading-tight ${textLayout(d.kind)}`}
      // Inline so it beats the app-wide focus ring; only the caret should show.
      style={{
        outline: 'none',
        boxShadow: 'none',
        color: d.stroke === 'auto' || d.stroke === 'none' ? 'var(--fg)' : d.stroke,
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          cancelled.current = true;
          e.currentTarget.blur();
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.currentTarget.blur();
        }
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}

function DrawingNodeView({ data, selected, width, height }: NodeProps<DrawingFlowNode>) {
  const d = data.drawing;
  const w = width ?? d.width;
  const h = height ?? d.height;
  const editing = useUiStore((s) => s.editingDrawingId === d.id);
  return (
    <div
      className="relative"
      style={{ width: w, height: h }}
      onDoubleClick={(e) => {
        if (!canHoldText(d)) return;
        e.stopPropagation();
        useUiStore.getState().setEditingDrawing(d.id);
      }}
    >
      <NodeResizer
        isVisible={selected && !editing}
        minWidth={MIN_SIZE}
        minHeight={MIN_SIZE}
        keepAspectRatio={d.kind === 'circle'}
        onResizeEnd={(_, p) =>
          useSessionStore
            .getState()
            .apply((doc) =>
              updateDrawings(doc, [d.id], { x: p.x, y: p.y, width: p.width, height: p.height }),
            )
        }
      />
      <DrawingShape drawing={editing ? { ...d, text: undefined } : d} width={w} height={h} />
      {editing && <TextEditor drawing={d} />}
    </div>
  );
}

export const DrawingNode = memo(DrawingNodeView);
