import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';

let clearTimer: ReturnType<typeof setTimeout> | undefined;

// Selects and briefly highlights elements on the real canvas. Connections also light up their
// end components, since only components have a highlight state.
export function focusOnCanvas(
  target: { nodeIds?: string[]; edgeIds?: string[] },
  durationMs = 2500,
): void {
  const ui = useUiStore.getState();
  const doc = useSessionStore.getState().doc;
  const nodeIds = (target.nodeIds ?? []).filter((id) =>
    doc?.architecture.nodes.some((n) => n.id === id),
  );
  const edgeIds = (target.edgeIds ?? []).filter((id) =>
    doc?.architecture.edges.some((e) => e.id === id),
  );
  if (nodeIds.length === 0 && edgeIds.length === 0) return;

  const highlighted = new Set(nodeIds);
  for (const e of doc?.architecture.edges ?? []) {
    if (edgeIds.includes(e.id)) {
      highlighted.add(e.source);
      highlighted.add(e.target);
    }
  }
  ui.setSelection(nodeIds, edgeIds);
  ui.setFocusNodes([...highlighted]);
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => useUiStore.getState().setFocusNodes([]), durationMs);
}
