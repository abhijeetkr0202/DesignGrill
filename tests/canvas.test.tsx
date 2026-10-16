import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ArchitectureCanvas } from '@/components/canvas/ArchitectureCanvas';
import { Inspector } from '@/components/canvas/Inspector';
import {
  MemoryPreferenceRepository,
  MemorySessionRepository,
} from '@/data/repositories/memory-repository';
import { setRepositoriesForTesting } from '@/data/repositories';
import { addComponent } from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { loadPack, newDoc } from './helpers';

beforeEach(async () => {
  setRepositoriesForTesting({
    sessions: new MemorySessionRepository(),
    preferences: new MemoryPreferenceRepository(),
    durable: true,
  });
  useSessionStore.getState().open(newDoc(), await loadPack());
  useUiStore.getState().clearSelection();
});

describe('ArchitectureCanvas', () => {
  it('adds typed components to the canonical model and selects the new one', async () => {
    const user = userEvent.setup();
    render(<ArchitectureCanvas />);
    await user.click(screen.getByRole('button', { name: 'Cache' }));
    await user.click(screen.getByRole('button', { name: 'Database' }));
    const nodes = useSessionStore.getState().doc?.architecture.nodes ?? [];
    expect(nodes.map((n) => [n.type, n.label])).toEqual([
      ['cache', 'Cache'],
      ['database', 'Database'],
    ]);
    expect(useUiStore.getState().selectedNodeIds).toEqual([nodes[1]?.id]);
  });

  it('lets a custom component be created with a free label', async () => {
    const user = userEvent.setup();
    render(<ArchitectureCanvas />);
    await user.click(screen.getByRole('button', { name: 'Custom' }));
    expect(useSessionStore.getState().doc?.architecture.nodes[0]?.type).toBe('custom');
  });
});

describe('Inspector', () => {
  it('edits component metadata through commands', async () => {
    const user = userEvent.setup();
    let id = '';
    useSessionStore.getState().apply((d) => {
      const r = addComponent(d, { type: 'cache', label: 'Redis', position: { x: 0, y: 0 } });
      id = r.id;
      return r.doc;
    });
    useUiStore.getState().setSelection([id], []);
    render(<Inspector />);

    const label = screen.getByLabelText('Label');
    await user.clear(label);
    await user.type(label, 'Redis cluster{Enter}');
    await user.type(screen.getByLabelText('Failure behaviour'), 'Fall back to DB{Tab}');
    expect(useSessionStore.getState().doc?.architecture.nodes[0]).toMatchObject({
      label: 'Redis cluster',
      failureBehavior: 'Fall back to DB',
    });

    await user.click(screen.getByRole('button', { name: 'Delete component' }));
    expect(useSessionStore.getState().doc?.architecture.nodes).toHaveLength(0);
  });

  it('explains what to do when nothing is selected', () => {
    render(<Inspector />);
    expect(screen.getByText(/Select a component or connection/)).toBeInTheDocument();
  });
});
