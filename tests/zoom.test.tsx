import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ tauri: true, setZoom: vi.fn(async () => undefined) }));

vi.mock('@tauri-apps/api/core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isTauri: () => mocks.tauri,
}));
vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({ setZoom: mocks.setZoom }),
}));

import { SettingsView } from '@/components/settings/SettingsView';
import { setRepositoriesForTesting } from '@/data/repositories';
import {
  MemoryPreferenceRepository,
  MemorySessionRepository,
} from '@/data/repositories/memory-repository';
import { useSettingsStore } from '@/features/settings/settings-store';
import {
  MAX_ZOOM_LEVEL,
  MIN_ZOOM_LEVEL,
  applyWebviewZoom,
  installZoomShortcuts,
  setZoomLevel,
  zoomFactor,
  zoomLevelForKey,
  zoomPercent,
} from '@/features/ui/zoom';
import { useUiStore } from '@/store/ui-store';

let prefs: MemoryPreferenceRepository;

beforeEach(() => {
  mocks.tauri = true;
  mocks.setZoom.mockClear();
  prefs = new MemoryPreferenceRepository();
  setRepositoriesForTesting({
    sessions: new MemorySessionRepository(),
    preferences: prefs,
    durable: true,
  });
  useUiStore.setState({ zoomLevel: 0 });
});

const key = (k: string, mods: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent('keydown', { key: k, cancelable: true, ...mods });

describe('zoom levels', () => {
  it('scales by 20% per step and reports a rounded percentage', () => {
    expect(zoomFactor(0)).toBe(1);
    expect(zoomFactor(1)).toBe(1.2);
    expect(zoomPercent(1)).toBe(120);
    expect(zoomPercent(-1)).toBe(83);
    expect(zoomFactor(99)).toBe(zoomFactor(MAX_ZOOM_LEVEL));
  });

  it('maps Cmd or Ctrl with plus, minus and zero, and ignores everything else', () => {
    expect(zoomLevelForKey({ key: '=', metaKey: true, ctrlKey: false, altKey: false }, 0)).toBe(1);
    expect(zoomLevelForKey({ key: '+', metaKey: false, ctrlKey: true, altKey: false }, 2)).toBe(3);
    expect(zoomLevelForKey({ key: '-', metaKey: true, ctrlKey: false, altKey: false }, 0)).toBe(-1);
    expect(zoomLevelForKey({ key: '0', metaKey: true, ctrlKey: false, altKey: false }, 4)).toBe(0);
    expect(
      zoomLevelForKey({ key: '=', metaKey: false, ctrlKey: false, altKey: false }, 0),
    ).toBeNull();
    expect(
      zoomLevelForKey({ key: '=', metaKey: true, ctrlKey: false, altKey: true }, 0),
    ).toBeNull();
    expect(
      zoomLevelForKey({ key: 'a', metaKey: true, ctrlKey: false, altKey: false }, 0),
    ).toBeNull();
  });

  it('stops at the minimum and maximum', () => {
    const up = { key: '=', metaKey: true, ctrlKey: false, altKey: false };
    const down = { key: '-', metaKey: true, ctrlKey: false, altKey: false };
    expect(zoomLevelForKey(up, MAX_ZOOM_LEVEL)).toBe(MAX_ZOOM_LEVEL);
    expect(zoomLevelForKey(down, MIN_ZOOM_LEVEL)).toBe(MIN_ZOOM_LEVEL);
  });
});

describe('zoom shortcuts in the desktop app', () => {
  it('zooms the window with Cmd or Ctrl plus, minus and zero, and remembers the level', async () => {
    const remove = installZoomShortcuts();

    const zoomIn = key('=', { metaKey: true });
    window.dispatchEvent(zoomIn);
    expect(zoomIn.defaultPrevented).toBe(true);
    expect(useUiStore.getState().zoomLevel).toBe(1);

    window.dispatchEvent(key('+', { ctrlKey: true }));
    expect(useUiStore.getState().zoomLevel).toBe(2);

    window.dispatchEvent(key('-', { metaKey: true }));
    expect(useUiStore.getState().zoomLevel).toBe(1);
    await vi.waitFor(async () => expect((await prefs.list())['ui.zoomLevel']).toBe('1'));

    window.dispatchEvent(key('0', { metaKey: true }));
    expect(useUiStore.getState().zoomLevel).toBe(0);

    const unrelated = key('=');
    window.dispatchEvent(unrelated);
    expect(unrelated.defaultPrevented).toBe(false);

    remove();
    window.dispatchEvent(key('=', { metaKey: true }));
    expect(useUiStore.getState().zoomLevel).toBe(0);
  });

  it('asks the webview to change its zoom factor', async () => {
    await applyWebviewZoom(2);
    expect(mocks.setZoom).toHaveBeenCalledWith(1.44);
  });

  it('does nothing in a plain browser, which has its own zoom', async () => {
    mocks.tauri = false;
    const remove = installZoomShortcuts();
    const event = key('=', { metaKey: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(useUiStore.getState().zoomLevel).toBe(0);
    await applyWebviewZoom(2);
    expect(mocks.setZoom).not.toHaveBeenCalled();
    remove();
  });

  it('survives a webview that refuses to zoom', async () => {
    mocks.setZoom.mockRejectedValueOnce(new Error('denied'));
    await expect(applyWebviewZoom(1)).resolves.toBeUndefined();
  });
});

describe('saved zoom', () => {
  it('is restored on startup and kept inside the allowed range', async () => {
    await prefs.set('ui.zoomLevel', '3');
    await useSettingsStore.getState().load();
    expect(useUiStore.getState().zoomLevel).toBe(3);

    await prefs.set('ui.zoomLevel', '999');
    await useSettingsStore.getState().load();
    expect(useUiStore.getState().zoomLevel).toBe(MAX_ZOOM_LEVEL);

    await prefs.set('ui.zoomLevel', 'not a number');
    await useSettingsStore.getState().load();
    expect(useUiStore.getState().zoomLevel).toBe(0);
  });

  it('is saved when changed', async () => {
    setZoomLevel(-2);
    expect(useUiStore.getState().zoomLevel).toBe(-2);
    await vi.waitFor(async () => expect((await prefs.list())['ui.zoomLevel']).toBe('-2'));
  });
});

describe('zoom controls in Settings', () => {
  it('step the zoom and reset it', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('120%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByText('83%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('are hidden in a plain browser', () => {
    mocks.tauri = false;
    render(<SettingsView />);
    expect(screen.queryByRole('button', { name: 'Zoom in' })).not.toBeInTheDocument();
  });
});
