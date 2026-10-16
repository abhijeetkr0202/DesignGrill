import { fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ArchitectureCanvas } from '@/components/canvas/ArchitectureCanvas';
import {
  MemoryPreferenceRepository,
  MemorySessionRepository,
} from '@/data/repositories/memory-repository';
import { setRepositoriesForTesting } from '@/data/repositories';
import { addComponent, updateComponent } from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { loadPack, newDoc } from './helpers';

let id = '';

beforeEach(async () => {
  setRepositoriesForTesting({
    sessions: new MemorySessionRepository(),
    preferences: new MemoryPreferenceRepository(),
    durable: true,
  });
  useSessionStore.getState().open(newDoc(), await loadPack());
  useSessionStore.getState().apply((d) => {
    const r = addComponent(d, {
      type: 'load-balancer',
      label: 'Edge LB',
      position: { x: 0, y: 0 },
    });
    id = r.id;
    return updateComponent(r.doc, r.id, { technologies: 'NGINX' });
  });
  useUiStore.setState({ selectedNodeIds: [], selectedEdgeIds: [] });
});

const node = (container: HTMLElement) =>
  within(container.querySelector<HTMLElement>(`[data-id="${id}"]`)!);
const doc = () => useSessionStore.getState().doc!.architecture.nodes[0]!;

describe('component text', () => {
  it('shows only the label on the canvas, not the component type', () => {
    const { container } = render(<ArchitectureCanvas />);
    expect(node(container).getByText('Edge LB')).toBeInTheDocument();
    expect(node(container).queryByText(/load balancer/i)).not.toBeInTheDocument();
  });

  it('edits the label in place on double-click and saves on Enter', async () => {
    const user = userEvent.setup();
    const { container } = render(<ArchitectureCanvas />);
    fireEvent.doubleClick(node(container).getByText('Edge LB'));
    const input = node(container).getByLabelText('Component label');
    expect(input).toHaveValue('Edge LB');
    await user.clear(input);
    await user.type(input, 'Public LB{Enter}');
    expect(doc().label).toBe('Public LB');
    expect(node(container).queryByRole('textbox', { hidden: true })).not.toBeInTheDocument();
    expect(node(container).getByText('Public LB')).toBeInTheDocument();
  });

  it('saves on blur, cancels on Escape and ignores an empty label', async () => {
    const user = userEvent.setup();
    const { container } = render(<ArchitectureCanvas />);

    fireEvent.doubleClick(node(container).getByText('Edge LB'));
    await user.type(node(container).getByRole('textbox', { hidden: true }), ' v2{Escape}');
    expect(doc().label).toBe('Edge LB');

    fireEvent.doubleClick(node(container).getByText('Edge LB'));
    const input = node(container).getByRole('textbox', { hidden: true });
    await user.clear(input);
    await user.tab();
    expect(doc().label).toBe('Edge LB');

    fireEvent.doubleClick(node(container).getByText('Edge LB'));
    await user.type(node(container).getByRole('textbox', { hidden: true }), '!');
    await user.tab();
    expect(doc().label).toBe('Edge LB!');
  });

  it('edits the technologies line in place', async () => {
    const user = userEvent.setup();
    const { container } = render(<ArchitectureCanvas />);
    fireEvent.doubleClick(node(container).getByText('NGINX'));
    const input = node(container).getByLabelText('Technologies');
    await user.clear(input);
    await user.type(input, 'Envoy{Enter}');
    expect(doc().technologies).toBe('Envoy');
  });
});
