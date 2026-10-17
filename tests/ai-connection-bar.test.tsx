import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiConnectionBar } from '@/components/layout/AiConnectionBar';
import { useSettingsStore, type ConnectionStatus } from '@/features/settings/settings-store';
import { useUiStore } from '@/store/ui-store';

const testConnection = vi.fn(async () => undefined);

function setStatus(
  status: ConnectionStatus,
  over: { provider?: 'openai' | 'custom'; error?: string } = {},
) {
  const provider = over.provider ?? 'openai';
  useSettingsStore.setState((s) => ({
    provider,
    testConnection,
    providers: {
      ...s.providers,
      [provider]: { status, error: over.error ?? null, availableModels: [] },
    },
  }));
}

beforeEach(() => {
  testConnection.mockClear();
  useUiStore.getState().setView('library');
  useSettingsStore.setState((s) => ({ models: { ...s.models, openai: 'gpt-4.1' } }));
});

describe('AiConnectionBar', () => {
  it('says which AI is connected and which model is selected', () => {
    setStatus('connected');
    render(<AiConnectionBar />);
    expect(screen.getByText(/Connected to/)).toHaveTextContent('Connected to OpenAI');
    expect(screen.getByText(/gpt-4\.1/)).toBeInTheDocument();
    expect(testConnection).not.toHaveBeenCalled();
  });

  it('names a custom endpoint by its display name', () => {
    setStatus('connected', { provider: 'custom' });
    render(<AiConnectionBar />);
    expect(screen.getByText(/Custom \(OpenAI-compatible\)/)).toBeInTheDocument();
  });

  it('offers a Connect AI button to Settings when there is no key', async () => {
    const user = userEvent.setup();
    setStatus('no-key');
    render(<AiConnectionBar />);
    expect(screen.getByText(/AI is not connected/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Connect AI' }));
    expect(useUiStore.getState().view).toBe('settings');
  });

  it('checks a saved key once and shows progress while it does', () => {
    setStatus('key-saved');
    render(<AiConnectionBar />);
    expect(testConnection).toHaveBeenCalledTimes(1);
    expect(testConnection).toHaveBeenCalledWith('openai');
    expect(screen.getByText('Checking the AI connection')).toBeInTheDocument();
  });

  it('does not re-check while a check is running or already finished', () => {
    setStatus('testing');
    const { rerender } = render(<AiConnectionBar />);
    setStatus('connected');
    rerender(<AiConnectionBar />);
    expect(testConnection).not.toHaveBeenCalled();
  });

  it('explains a failure and offers Retry and Settings', async () => {
    const user = userEvent.setup();
    setStatus('failed', { error: 'The provider rejected the API key.' });
    render(<AiConnectionBar />);
    expect(screen.getByText(/Could not connect to/)).toHaveTextContent('OpenAI');
    expect(screen.getByText(/rejected the API key/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(testConnection).toHaveBeenCalledWith('openai');

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(useUiStore.getState().view).toBe('settings');
  });
});
