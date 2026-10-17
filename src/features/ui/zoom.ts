import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getRepositories } from '@/data/repositories';
import { useUiStore } from '@/store/ui-store';

// Each step scales the UI by 20%, the same as VS Code's zoom levels.
export const ZOOM_STEP_FACTOR = 1.2;
export const MIN_ZOOM_LEVEL = -5;
export const MAX_ZOOM_LEVEL = 8;
export const ZOOM_PREFERENCE = 'ui.zoomLevel';

export function clampZoomLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, Math.round(level)));
}

export function zoomFactor(level: number): number {
  return Math.round(ZOOM_STEP_FACTOR ** clampZoomLevel(level) * 1000) / 1000;
}

export function zoomPercent(level: number): number {
  return Math.round(zoomFactor(level) * 100);
}

type KeyLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>;

// Cmd/Ctrl plus "+" or "=" zooms in, "-" zooms out, "0" resets. Returns null for other keys.
export function zoomLevelForKey(e: KeyLike, current: number): number | null {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return null;
  switch (e.key) {
    case '=':
    case '+':
      return clampZoomLevel(current + 1);
    case '-':
    case '_':
      return clampZoomLevel(current - 1);
    case '0':
      return 0;
    default:
      return null;
  }
}

export function setZoomLevel(level: number): void {
  const next = clampZoomLevel(level);
  useUiStore.getState().setZoomLevel(next);
  void getRepositories()
    .preferences.set(ZOOM_PREFERENCE, String(next))
    .catch(() => undefined);
}

// The browser handles its own zoom shortcuts; only the desktop webview needs this.
export async function applyWebviewZoom(level: number): Promise<void> {
  if (!isTauri()) return;
  try {
    await getCurrentWebview().setZoom(zoomFactor(level));
  } catch {
    // Zoom is cosmetic; a failure must not break the app.
  }
}

export function installZoomShortcuts(): () => void {
  if (!isTauri()) return () => undefined;
  const onKeyDown = (e: KeyboardEvent) => {
    const next = zoomLevelForKey(e, useUiStore.getState().zoomLevel);
    if (next === null) return;
    e.preventDefault();
    setZoomLevel(next);
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
