import { useEffect } from 'react';
import { PROVIDER_INFO } from '@/ai/provider-registry';
import { useSettingsStore } from '@/features/settings/settings-store';
import { useUiStore } from '@/store/ui-store';
import { Button, Spinner } from '@/components/shared/ui';

function Dot({ tone }: { tone: 'ok' | 'danger' | 'muted' }) {
  const color = tone === 'ok' ? 'bg-ok' : tone === 'danger' ? 'bg-danger' : 'bg-muted';
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

// Shows whether the selected AI provider is usable and routes to Settings when it is not.
export function AiConnectionBar() {
  const provider = useSettingsStore((s) => s.provider);
  const model = useSettingsStore((s) => s.models[s.provider]);
  const status = useSettingsStore((s) => s.providers[s.provider].status);
  const error = useSettingsStore((s) => s.providers[s.provider].error);
  const info = PROVIDER_INFO[provider];
  const openSettings = () => useUiStore.getState().setView('settings');
  const check = () => void useSettingsStore.getState().testConnection(provider);

  // A saved key is verified once so the bar can say "Connected" rather than guess.
  useEffect(() => {
    if (status === 'key-saved') void useSettingsStore.getState().testConnection(provider);
  }, [status, provider]);

  let body;
  switch (status) {
    case 'connected':
      body = (
        <>
          <Dot tone="ok" />
          <span>
            Connected to <span className="font-semibold">{info.displayName}</span>
            {model ? <span className="text-muted"> · {model}</span> : null}
          </span>
        </>
      );
      break;
    case 'failed':
      body = (
        <>
          <Dot tone="danger" />
          <span>
            Could not connect to <span className="font-semibold">{info.displayName}</span>.{' '}
            <span className="text-muted">{error ?? 'Check the key or endpoint in Settings.'}</span>
          </span>
        </>
      );
      break;
    case 'no-key':
      body = (
        <>
          <Dot tone="muted" />
          <span>AI is not connected. Everything except the interviewer works without it.</span>
        </>
      );
      break;
    default:
      body = (
        <>
          <Spinner label="Checking the AI connection" />
          <span className="text-muted">Checking the AI connection</span>
        </>
      );
  }

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs"
    >
      <div className="flex min-w-0 items-center gap-2">{body}</div>
      <div className="flex shrink-0 gap-1.5">
        {status === 'no-key' && (
          <Button size="sm" variant="primary" onClick={openSettings}>
            Connect AI
          </Button>
        )}
        {status === 'failed' && (
          <>
            <Button size="sm" onClick={check}>
              Retry
            </Button>
            <Button size="sm" variant="primary" onClick={openSettings}>
              Open settings
            </Button>
          </>
        )}
        {status === 'connected' && (
          <Button size="sm" variant="ghost" onClick={openSettings}>
            Change
          </Button>
        )}
      </div>
    </div>
  );
}
