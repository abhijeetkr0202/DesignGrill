import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROVIDER_IDS, PROVIDER_INFO, createProvider } from '@/ai/provider-registry';
import { SettingsView } from '@/components/settings/SettingsView';
import { setRepositoriesForTesting } from '@/data/repositories';
import {
  MemoryPreferenceRepository,
  MemorySessionRepository,
} from '@/data/repositories/memory-repository';
import { useSettingsStore } from '@/features/settings/settings-store';
import { FakeTransport } from './helpers';

describe('OpenRouter provider', () => {
  it('is a built-in choice listed before the custom endpoint', () => {
    expect(PROVIDER_IDS).toEqual(['openai', 'anthropic', 'openrouter', 'custom']);
    expect(PROVIDER_INFO.openrouter).toMatchObject({
      displayName: 'OpenRouter',
      defaultModel: 'openai/gpt-4.1',
    });
  });

  it('sends chat completions to the fixed OpenRouter host with compatible parameters', async () => {
    const transport = new FakeTransport([
      {
        status: 200,
        body: JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
        }),
      },
    ]);
    const provider = createProvider('openrouter', transport);
    expect(provider.id).toBe('openrouter');
    expect(provider.displayName).toBe('OpenRouter');

    await provider.complete({
      model: 'anthropic/claude-sonnet-4.5',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      maxOutputTokens: 321,
      json: true,
    });
    const sent = transport.sent[0]!;
    expect(sent).toMatchObject({ provider: 'openrouter', path: '/v1/chat/completions' });
    expect(sent.baseUrl).toBeUndefined();
    expect(sent.body).toMatchObject({ model: 'anthropic/claude-sonnet-4.5', max_tokens: 321 });
    expect(sent.body).not.toHaveProperty('max_completion_tokens');
    expect(sent.body).not.toHaveProperty('response_format');
  });

  it('checks the key itself, because the model list is public', async () => {
    const bad = new FakeTransport([{ status: 401, body: '{"error":{"message":"No auth"}}' }]);
    await expect(createProvider('openrouter', bad).testConnection()).rejects.toMatchObject({
      kind: 'invalid-credentials',
    });
    expect(bad.sent[0]).toMatchObject({ method: 'GET', path: '/v1/auth/key' });

    const good = new FakeTransport([{ status: 200, body: '{"data":{"label":"k"}}' }]);
    await expect(createProvider('openrouter', good).testConnection()).resolves.toBeUndefined();
    expect(good.sent).toHaveLength(1);
  });

  it('falls back to the model list if the key endpoint is not found', async () => {
    const transport = new FakeTransport([
      { status: 404, body: 'not found' },
      { status: 200, body: JSON.stringify({ data: [{ id: 'openai/gpt-4.1' }] }) },
    ]);
    await expect(createProvider('openrouter', transport).testConnection()).resolves.toBeUndefined();
    expect(transport.sent.map((s) => s.path)).toEqual(['/v1/auth/key', '/v1/models']);
  });

  it('keeps the other providers on their own test and parameters', async () => {
    const transport = new FakeTransport([{ status: 200, body: JSON.stringify({ data: [] }) }]);
    await createProvider('openai', transport).testConnection();
    expect(transport.sent[0]?.path).toBe('/v1/models');
  });
});

describe('OpenRouter in Settings', () => {
  beforeEach(() => {
    setRepositoriesForTesting({
      sessions: new MemorySessionRepository(),
      preferences: new MemoryPreferenceRepository(),
      durable: true,
    });
    useSettingsStore.setState({ provider: 'openai' });
  });

  it('can be selected, keeps its own model, and explains its model names', async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    await user.click(screen.getByRole('tab', { name: 'OpenRouter' }));
    expect(useSettingsStore.getState().provider).toBe('openrouter');
    expect(await screen.findByDisplayValue('openai/gpt-4.1')).toBeInTheDocument();
    expect(screen.getByText(/vendor\/model/)).toBeInTheDocument();
    expect(screen.getByText(/openrouter\.ai\/settings\/keys/)).toBeInTheDocument();
    // It needs no endpoint field, unlike the custom option.
    expect(screen.queryByLabelText('Endpoint URL')).not.toBeInTheDocument();
  });
});
