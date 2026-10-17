import { useEffect, type ReactNode } from 'react';
import { useSettingsStore } from '@/features/settings/settings-store';
import { applyWebviewZoom, installZoomShortcuts } from '@/features/ui/zoom';
import { useUiStore } from '@/store/ui-store';

// Loads local preferences once and keeps the theme class and window zoom in sync with the store.
export function Providers({ children }: { children: ReactNode }) {
  const theme = useUiStore((s) => s.theme);
  const zoomLevel = useUiStore((s) => s.zoomLevel);

  useEffect(() => {
    void useSettingsStore.getState().load();
    return installZoomShortcuts();
  }, []);

  useEffect(() => {
    void applyWebviewZoom(zoomLevel);
  }, [zoomLevel]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return <>{children}</>;
}
