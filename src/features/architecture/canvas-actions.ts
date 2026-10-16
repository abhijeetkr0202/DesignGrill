import {
  clipboardBounds,
  collectClipboard,
  pasteClipboard,
  removeComponents,
  removeDrawings,
  removeEdges,
} from '@/features/interview-session/commands';
import { useClipboardStore } from '@/store/clipboard-store';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';

const PASTE_STEP = 32;

export function deleteSelection(): boolean {
  const { selectedNodeIds: ids, selectedEdgeIds: edgeIds } = useUiStore.getState();
  if (ids.length + edgeIds.length === 0) return false;
  useSessionStore
    .getState()
    .apply((d) => removeEdges(removeDrawings(removeComponents(d, ids), ids), edgeIds));
  useUiStore.getState().clearSelection();
  return true;
}

export function copySelection(options: { cut?: boolean } = {}): boolean {
  const doc = useSessionStore.getState().doc;
  const ids = useUiStore.getState().selectedNodeIds;
  const data = doc && collectClipboard(doc, ids);
  if (!data) return false;
  useClipboardStore.getState().set(data, options);
  if (options.cut) deleteSelection();
  return true;
}

// With a point, the copy lands there; otherwise each paste steps diagonally from the original.
export function pasteFromClipboard(at?: { x: number; y: number }): boolean {
  const { data, pasteCount } = useClipboardStore.getState();
  if (!data) return false;
  let offset = { dx: PASTE_STEP * (pasteCount + 1), dy: PASTE_STEP * (pasteCount + 1) };
  if (at) {
    const origin = clipboardBounds(data);
    offset = { dx: at.x - origin.x, dy: at.y - origin.y };
  }
  let pasted: string[] = [];
  useSessionStore.getState().apply((d) => {
    const r = pasteClipboard(d, data, offset);
    pasted = r.ids;
    return r.doc;
  });
  if (pasted.length === 0) return false;
  if (!at) useClipboardStore.getState().bump();
  useUiStore.getState().setSelection(pasted, []);
  return true;
}
