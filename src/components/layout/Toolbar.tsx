import { useState } from 'react';
import { getInterviewService, useAiStore } from '@/features/interview-session/ai-store';
import { setSessionStatus } from '@/features/interview-session/commands';
import { leaveSession } from '@/features/interview-session/session-service';
import { useSettingsStore } from '@/features/settings/settings-store';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { Badge, Button, ConfirmDialog } from '@/components/shared/ui';

export function Toolbar() {
  const doc = useSessionStore((s) => s.doc);
  const saveStatus = useSessionStore((s) => s.saveStatus);
  const saveError = useSessionStore((s) => s.saveError);
  const canUndo = useSessionStore((s) => s.undoStack.length > 0);
  const canRedo = useSessionStore((s) => s.redoStack.length > 0);
  const running = useAiStore((s) => s.state.status === 'running');
  const theme = useUiStore((s) => s.theme);
  const [confirmingNew, setConfirmingNew] = useState(false);
  if (!doc) return null;

  const saveLabel = {
    idle: 'Not saved',
    dirty: 'Unsaved changes',
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Save failed',
  }[saveStatus];

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-3 py-1.5">
      <button
        type="button"
        className="font-semibold text-accent"
        onClick={() => void leaveSession()}
        title="Back to problem library"
      >
        DesignGrill
      </button>
      <span className="text-muted">/</span>
      <h1 className="text-[13px] font-semibold">{doc.title}</h1>
      <Badge tone={doc.status === 'completed' ? 'ok' : 'neutral'}>
        {doc.status === 'completed' ? 'Completed' : 'In progress'}
      </Badge>
      <span
        className={`text-xs ${saveStatus === 'error' ? 'text-danger' : 'text-muted'}`}
        role="status"
        title={saveError ?? undefined}
      >
        {saveLabel}
      </span>
      {saveStatus === 'error' && (
        <Button size="sm" onClick={() => void useSessionStore.getState().save()}>
          Retry save
        </Button>
      )}

      <div className="ml-2 flex gap-1">
        <Button
          size="sm"
          disabled={!canUndo}
          onClick={() => useSessionStore.getState().undo()}
          title="Undo (Ctrl/Cmd+Z)"
        >
          Undo
        </Button>
        <Button
          size="sm"
          disabled={!canRedo}
          onClick={() => useSessionStore.getState().redo()}
          title="Redo (Ctrl/Cmd+Shift+Z)"
        >
          Redo
        </Button>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Button
          variant="primary"
          size="sm"
          disabled={running}
          onClick={() => void getInterviewService().request('architecture-review')}
        >
          Review architecture
        </Button>
        <Button
          size="sm"
          onClick={() =>
            useSessionStore
              .getState()
              .apply(
                (d) => setSessionStatus(d, d.status === 'completed' ? 'in-progress' : 'completed'),
                { history: false },
              )
          }
        >
          {doc.status === 'completed' ? 'Reopen' : 'Mark complete'}
        </Button>
        <Button size="sm" onClick={() => setConfirmingNew(true)}>
          New session
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          onClick={() =>
            void useSettingsStore.getState().setTheme(theme === 'dark' ? 'light' : 'dark')
          }
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </Button>
        <Button size="sm" onClick={() => useUiStore.getState().setView('settings')}>
          Settings
        </Button>
      </div>

      {confirmingNew && (
        <ConfirmDialog
          title="Leave this session?"
          message="Your session is saved automatically and can be resumed from the library. You can then start a new one."
          confirmLabel="Go to library"
          onCancel={() => setConfirmingNew(false)}
          onConfirm={() => {
            setConfirmingNew(false);
            void leaveSession();
          }}
        />
      )}
    </header>
  );
}
