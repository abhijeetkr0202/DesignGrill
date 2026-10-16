import { lazy, Suspense } from 'react';
import { LibraryView } from '@/components/layout/LibraryView';
import { Spinner } from '@/components/shared/ui';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';

// The canvas library is heavy, so the workspace and settings load only when first opened.
const Workspace = lazy(() =>
  import('@/components/layout/Workspace').then((m) => ({ default: m.Workspace })),
);
const SettingsView = lazy(() =>
  import('@/components/settings/SettingsView').then((m) => ({ default: m.SettingsView })),
);

const Loading = () => (
  <div className="flex h-full items-center justify-center">
    <Spinner label="Loading" />
  </div>
);

// Three views, so a plain state switch is enough; no URL routing is needed in a desktop shell.
export function Router() {
  const view = useUiStore((s) => s.view);
  const hasSession = useSessionStore((s) => s.doc !== null);
  if (view === 'settings') {
    return (
      <Suspense fallback={<Loading />}>
        <SettingsView />
      </Suspense>
    );
  }
  if (view === 'workspace' && hasSession) {
    return (
      <Suspense fallback={<Loading />}>
        <Workspace />
      </Suspense>
    );
  }
  return <LibraryView />;
}
