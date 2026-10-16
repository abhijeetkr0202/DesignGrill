import { useState } from 'react';
import type { ProviderId } from '@/ai/provider-interface';
import { PROVIDER_IDS, PROVIDER_INFO } from '@/ai/provider-registry';
import { useSettingsStore, type ConnectionStatus } from '@/features/settings/settings-store';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { getRepositories } from '@/data/repositories';
import { Badge, Button, ConfirmDialog, Notice, Spinner, fieldClass } from '@/components/shared/ui';

const STATUS: Record<
  ConnectionStatus,
  { label: string; tone: 'neutral' | 'ok' | 'warn' | 'danger' }
> = {
  unknown: { label: 'Checking…', tone: 'neutral' },
  'no-key': { label: 'No key saved', tone: 'neutral' },
  'key-saved': { label: 'Key saved, not tested', tone: 'warn' },
  testing: { label: 'Testing…', tone: 'neutral' },
  connected: { label: 'Connected', tone: 'ok' },
  failed: { label: 'Connection failed', tone: 'danger' },
};

export function SettingsView() {
  const provider = useSettingsStore((s) => s.provider);
  const theme = useUiStore((s) => s.theme);
  const hasSession = useSessionStore((s) => s.doc !== null);

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Settings</h1>
        <Button onClick={() => useUiStore.getState().setView(hasSession ? 'workspace' : 'library')}>
          Back
        </Button>
      </header>

      <section className="mb-8" aria-labelledby="ai-heading">
        <h2 id="ai-heading" className="mb-1 text-sm font-semibold">
          AI provider
        </h2>
        <p className="mb-3 text-xs text-muted">
          Everything except AI features works without a provider. Requests go directly from this app
          to the provider you choose; there is no DesignGrill server. API usage is billed by the
          provider, separately from any ChatGPT or Claude subscription, and a consumer subscription
          does not include API access.
        </p>
        <div role="tablist" aria-label="Provider" className="mb-3 flex gap-1">
          {PROVIDER_IDS.map((id) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={provider === id}
              onClick={() => void useSettingsStore.getState().setProvider(id)}
              className={`rounded border px-3 py-1 text-xs ${provider === id ? 'border-accent text-accent' : 'border-line text-muted'}`}
            >
              {PROVIDER_INFO[id].displayName}
            </button>
          ))}
        </div>
        <ProviderForm id={provider} />
      </section>

      <section aria-labelledby="appearance-heading" className="mb-8">
        <h2 id="appearance-heading" className="mb-2 text-sm font-semibold">
          Appearance
        </h2>
        <div className="flex gap-2">
          {(['dark', 'light'] as const).map((t) => (
            <Button
              key={t}
              variant={theme === t ? 'primary' : 'secondary'}
              onClick={() => void useSettingsStore.getState().setTheme(t)}
            >
              {t === 'dark' ? 'Dark' : 'Light'}
            </Button>
          ))}
        </div>
      </section>

      <section aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="mb-2 text-sm font-semibold">
          Privacy
        </h2>
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
          <li>
            Sessions are stored in a local SQLite database in your user data directory. There is no
            telemetry.
          </li>
          <li>
            API keys are stored only in your operating system credential store, never in the
            database or in files.
          </li>
          <li>
            When you use an AI action, your requirements, architecture, decisions, and recent
            messages are sent to the selected provider.
          </li>
          {!getRepositories().durable && (
            <li>This is a browser preview: nothing is persisted and keys cannot be stored.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function ProviderForm({ id }: { id: ProviderId }) {
  const info = PROVIDER_INFO[id];
  const state = useSettingsStore((s) => s.providers[id]);
  const model = useSettingsStore((s) => s.models[id]);
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const status = STATUS[state.status];
  const hasKey = state.status !== 'no-key' && state.status !== 'unknown';

  const save = async () => {
    setSaving(true);
    setLocalError(null);
    try {
      await useSettingsStore.getState().saveKey(id, key);
      setKey('');
      await useSettingsStore.getState().testConnection(id);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not save the key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold">{info.displayName}</h3>
        <Badge tone={status.tone}>{status.label}</Badge>
        {state.status === 'testing' && <Spinner label="Testing connection" />}
      </div>

      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (key.trim()) void save();
        }}
      >
        <label className="block text-[11px] font-medium text-muted" htmlFor={`key-${id}`}>
          {hasKey ? 'Replace API key' : 'API key'}
        </label>
        <div className="flex gap-2">
          <input
            id={`key-${id}`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            className={fieldClass}
            value={key}
            placeholder={
              hasKey ? 'A key is stored. Enter a new one to replace it.' : 'Paste your API key'
            }
            onChange={(e) => setKey(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={!key.trim() || saving}>
            {saving ? 'Saving…' : 'Save key'}
          </Button>
        </div>
        <p className="text-[11px] text-muted">
          The key is handed to the OS credential store and is not shown again.{' '}
          <span>Create one in the provider console: {info.consoleUrl}</span>
        </p>
      </form>

      <div>
        <label className="mb-0.5 block text-[11px] font-medium text-muted" htmlFor={`model-${id}`}>
          Model
        </label>
        <input
          id={`model-${id}`}
          className={fieldClass}
          list={`models-${id}`}
          value={model}
          onChange={(e) => void useSettingsStore.getState().setModel(id, e.target.value)}
        />
        <datalist id={`models-${id}`}>
          {state.availableModels.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <p className="mt-0.5 text-[11px] text-muted">
          Model names change over time. The default may be outdated; run a connection test to list
          the models your key can use, or type any model identifier.
        </p>
      </div>

      {(localError || state.error) && <Notice tone="danger">{localError ?? state.error}</Notice>}

      <div className="flex gap-2">
        <Button
          disabled={!hasKey || state.status === 'testing'}
          onClick={() => void useSettingsStore.getState().testConnection(id)}
        >
          Test connection
        </Button>
        <Button variant="danger" disabled={!hasKey} onClick={() => setConfirmingDelete(true)}>
          Delete stored key
        </Button>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete the stored API key?"
          message={`The ${info.displayName} key will be removed from the credential store. AI actions will stop working until you add a key again.`}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            void useSettingsStore
              .getState()
              .removeKey(id)
              .catch((e: unknown) =>
                setLocalError(e instanceof Error ? e.message : 'Could not delete the key'),
              );
          }}
        />
      )}
    </div>
  );
}
