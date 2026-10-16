import { useEffect, type ReactNode } from 'react';
import { useSettingsStore } from '@/features/settings/settings-store';
import { useUiStore } from '@/store/ui-store';

// Loads local preferences once and keeps the theme class on <html> in sync with the store.
export function Providers({ children }: { children: ReactNode }) {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    void useSettingsStore.getState().load();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return <>{children}</>;
}
