import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { LibraryView } from '@/components/layout/LibraryView';
import {
  MemoryPreferenceRepository,
  MemorySessionRepository,
} from '@/data/repositories/memory-repository';
import { setRepositoriesForTesting } from '@/data/repositories';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';

beforeEach(() => {
  setRepositoriesForTesting({
    sessions: new MemorySessionRepository(),
    preferences: new MemoryPreferenceRepository(),
    durable: true,
  });
  useSessionStore.setState({ doc: null, pack: null });
  useUiStore.getState().setView('library');
});

describe('LibraryView', () => {
  it('still lists the bundled problems first', async () => {
    render(<LibraryView />);
    expect(await screen.findByText('URL Shortener')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Start practice' })).toHaveLength(3);
  });

  it('creates a named blank canvas and opens the workspace', async () => {
    const user = userEvent.setup();
    render(<LibraryView />);
    const create = screen.getByRole('button', { name: 'Create blank canvas' });
    expect(create).toBeDisabled();

    await user.type(screen.getByLabelText('Session name'), 'Payments ledger');
    await user.click(create);

    await waitFor(() => expect(useUiStore.getState().view).toBe('workspace'));
    expect(useSessionStore.getState().doc?.title).toBe('Payments ledger');
    expect(useSessionStore.getState().doc?.problemId).toBe('custom');
  });
});
