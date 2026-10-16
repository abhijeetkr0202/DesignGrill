import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { LibraryView } from '@/components/layout/LibraryView';
import { startCustomSession } from '@/features/interview-session/session-service';
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
  it('lists the bundled problems and filters them', async () => {
    const user = userEvent.setup();
    render(<LibraryView />);
    expect(await screen.findByText('URL Shortener')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Start practice' }).length).toBeGreaterThanOrEqual(
      50,
    );

    await user.type(screen.getByLabelText('Search problems'), 'url shortener');
    expect(screen.getAllByRole('button', { name: 'Start practice' })).toHaveLength(1);

    await user.clear(screen.getByLabelText('Search problems'));
    await user.type(screen.getByLabelText('Search problems'), 'zzzz-no-match');
    expect(screen.getByText('No problems match these filters.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search problems'));
    await user.selectOptions(screen.getByLabelText('Filter by difficulty'), 'easy');
    const easy = screen.getAllByRole('button', { name: 'Start practice' }).length;
    expect(easy).toBeGreaterThan(0);
    expect(easy).toBeLessThan(50);
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

  it('opens saved sessions in a dialog and resumes one into the workspace', async () => {
    const user = userEvent.setup();
    await startCustomSession({ title: 'Saved design', statement: '' });
    useSessionStore.setState({ doc: null, pack: null });
    useUiStore.getState().setView('library');

    render(<LibraryView />);
    const open = await screen.findByRole('button', { name: 'Saved sessions (1)' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(open);
    const dialog = screen.getByRole('dialog', { name: 'Saved sessions' });
    expect(within(dialog).getByText('Saved design')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(useUiStore.getState().view).toBe('workspace'));
    expect(useSessionStore.getState().doc?.title).toBe('Saved design');
  });

  it('closes the saved sessions dialog with Escape', async () => {
    const user = userEvent.setup();
    render(<LibraryView />);
    await user.click(screen.getByRole('button', { name: 'Saved sessions (0)' }));
    expect(screen.getByText('No saved sessions yet.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
