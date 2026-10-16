import { fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ArchitectureCanvas } from '@/components/canvas/ArchitectureCanvas';
import {
  MemoryPreferenceRepository,
  MemorySessionRepository,
} from '@/data/repositories/memory-repository';
import { setRepositoriesForTesting } from '@/data/repositories';
import { describeDrawings } from '@/features/architecture/annotations';
import { addComponent } from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { DEFAULT_DRAW_STYLE } from '@/features/architecture/drawing-geometry';
import { loadPack, newDoc } from './helpers';

beforeEach(async () => {
  setRepositoriesForTesting({
    sessions: new MemorySessionRepository(),
    preferences: new MemoryPreferenceRepository(),
    durable: true,
  });
  useSessionStore.getState().open(newDoc(), await loadPack());
  useUiStore.setState({
    selectedNodeIds: [],
    selectedEdgeIds: [],
    editingDrawingId: null,
    drawOpen: false,
    drawTool: 'select',
    drawStyle: DEFAULT_DRAW_STYLE,
  });
});

const drawings = () => useSessionStore.getState().doc!.architecture.drawings;
const pane = (c: HTMLElement) => c.querySelector('.react-flow__pane')!;

describe('canvas notes', () => {
  it('double-clicking empty canvas creates a note that is ready to type in', async () => {
    const user = userEvent.setup();
    const { container } = render(<ArchitectureCanvas />);
    fireEvent.doubleClick(pane(container), { clientX: 120, clientY: 80 });

    expect(drawings()).toHaveLength(1);
    expect(drawings()[0]).toMatchObject({ kind: 'text', width: 200, height: 60, fill: 'none' });
    const box = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Drawing text"]',
    )!;
    expect(box).toHaveFocus();

    await user.type(box, 'Read path{Enter}- cache first{Tab}');
    expect(drawings()[0]!.text).toBe('Read path\n- cache first');
    expect(container.querySelector('textarea')).toBeNull();
    expect(useUiStore.getState().editingDrawingId).toBeNull();
  });

  it('saves with Ctrl+Enter and keeps Enter for line breaks', async () => {
    const user = userEvent.setup();
    const { container } = render(<ArchitectureCanvas />);
    fireEvent.doubleClick(pane(container));
    await user.type(
      container.querySelector('textarea')!,
      'one{Enter}two{Control>}{Enter}{/Control}',
    );
    expect(drawings()[0]!.text).toBe('one\ntwo');
  });

  it('discards a note that was never written, whether blurred or cancelled', async () => {
    const user = userEvent.setup();
    const { container } = render(<ArchitectureCanvas />);
    fireEvent.doubleClick(pane(container));
    await user.tab();
    expect(drawings()).toHaveLength(0);

    fireEvent.doubleClick(pane(container));
    await user.type(container.querySelector('textarea')!, 'draft{Escape}');
    expect(drawings()).toHaveLength(0);
  });

  it('edits an existing note on double-click and cancels with Escape', async () => {
    const user = userEvent.setup();
    const { container } = render(<ArchitectureCanvas />);
    fireEvent.doubleClick(pane(container));
    await user.type(container.querySelector('textarea')!, 'first{Tab}');
    const id = drawings()[0]!.id;

    fireEvent.doubleClick(container.querySelector(`[data-id="${id}"] > div`)!);
    const box = container.querySelector('textarea')!;
    expect(box).toHaveValue('first');
    await user.type(box, ' edited{Escape}');
    expect(drawings()[0]!.text).toBe('first');

    fireEvent.doubleClick(container.querySelector(`[data-id="${id}"] > div`)!);
    await user.type(container.querySelector('textarea')!, ' v2{Tab}');
    expect(drawings()[0]!.text).toBe('first v2');
  });

  it('does not create a note when a component is double-clicked', () => {
    let id = '';
    useSessionStore.getState().apply((d) => {
      const r = addComponent(d, { type: 'service', position: { x: 0, y: 0 } });
      id = r.id;
      return r.doc;
    });
    const { container } = render(<ArchitectureCanvas />);
    fireEvent.doubleClick(container.querySelector(`[data-id="${id}"]`)!);
    expect(drawings()).toHaveLength(0);
  });

  it('shares notes with the interviewer as annotations', async () => {
    const user = userEvent.setup();
    const { container } = render(<ArchitectureCanvas />);
    fireEvent.doubleClick(pane(container));
    await user.type(container.querySelector('textarea')!, 'Mindmap: sharding idea{Tab}');
    const notes = describeDrawings(useSessionStore.getState().doc!.architecture);
    expect(notes[0]).toMatchObject({ kind: 'text', text: 'Mindmap: sharding idea' });
  });
});
