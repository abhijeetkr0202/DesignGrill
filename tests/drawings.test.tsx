import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ArchitectureCanvas } from '@/components/canvas/ArchitectureCanvas';
import { Inspector } from '@/components/canvas/Inspector';
import {
  MemoryPreferenceRepository,
  MemorySessionRepository,
} from '@/data/repositories/memory-repository';
import { setRepositoriesForTesting, fromRecord, toRecord } from '@/data/repositories';
import { computeChanges, takeBaseline } from '@/features/design-review/changes';
import { buildSnapshot } from '@/features/design-review/snapshot';
import {
  DEFAULT_DRAW_STYLE,
  buildDrawing,
  lineEndpoints,
} from '@/features/architecture/drawing-geometry';
import {
  addComponent,
  addDrawing,
  moveComponents,
  removeDrawings,
  setReviewBaseline,
  updateDrawings,
} from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { DrawingSchema } from '@/types/session';
import { loadPack, makeCtx, newDoc } from './helpers';

const style = DEFAULT_DRAW_STYLE;

describe('buildDrawing', () => {
  it('uses a default size for a plain click', () => {
    const d = buildDrawing('rectangle', { x: 10, y: 20 }, { x: 11, y: 21 }, [], style);
    expect(d).toMatchObject({ x: 10, y: 20, width: 120, height: 80 });
  });

  it('normalises drags in any direction', () => {
    const d = buildDrawing('ellipse', { x: 100, y: 100 }, { x: 40, y: 70 }, [], style);
    expect(d).toMatchObject({ x: 40, y: 70, width: 60, height: 30 });
  });

  it('keeps circles square', () => {
    const d = buildDrawing('circle', { x: 100, y: 100 }, { x: 60, y: 130 }, [], style);
    expect(d.width).toBe(d.height);
    expect(d).toMatchObject({ x: 60, y: 100, width: 40 });
  });

  it('records line direction with flip flags and keeps horizontal lines hit-testable', () => {
    const d = buildDrawing('arrow', { x: 200, y: 50 }, { x: 100, y: 50 }, [], style);
    expect(d).toMatchObject({ flipX: true, flipY: false, width: 100 });
    expect(d.height).toBeGreaterThanOrEqual(12);
    const { y1, y2 } = lineEndpoints(d, d.width, d.height);
    expect(y1).toBe(y2);
  });

  it('normalises freehand strokes into the unit box and limits their size', () => {
    const path = Array.from({ length: 2000 }, (_, i) => ({ x: i, y: Math.sin(i / 20) * 30 }));
    const d = buildDrawing('freehand', path[0]!, path.at(-1)!, path, style);
    expect(d.points!.length).toBeLessThanOrEqual(600);
    for (const [x, y] of d.points!) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
    expect(DrawingSchema.safeParse({ ...d, id: 'x' }).success).toBe(true);
  });
});

describe('drawing commands', () => {
  const input = buildDrawing('rectangle', { x: 0, y: 0 }, { x: 100, y: 50 }, [], style);

  it('counts adding, relabelling and removing as design changes but not moving or restyling', () => {
    const ctx = makeCtx();
    const added = addDrawing(newDoc(ctx), input, ctx);
    expect(added.doc.revision).toBe(1);
    let doc = updateDrawings(added.doc, [added.id], { stroke: '#e03131', fill: '#1971c2' }, ctx);
    expect(doc.architecture.drawings[0]).toMatchObject({ stroke: '#e03131', fill: '#1971c2' });
    doc = moveComponents(doc, { [added.id]: { x: 30, y: 40 } }, ctx);
    expect(doc.architecture.drawings[0]).toMatchObject({ x: 30, y: 40 });
    doc = updateDrawings(doc, [added.id], { width: 300, height: 200 }, ctx);
    expect(doc.revision).toBe(1);
    doc = updateDrawings(doc, [added.id], { text: 'VPC' }, ctx);
    expect(doc.revision).toBe(2);
    doc = updateDrawings(doc, [added.id], { text: 'VPC' }, ctx);
    expect(doc.revision).toBe(2);
    doc = removeDrawings(doc, [added.id], ctx);
    expect(doc.architecture.drawings).toHaveLength(0);
    expect(doc.revision).toBe(3);
  });

  it('sends drawings to the interviewer with the components they relate to', async () => {
    const ctx = makeCtx();
    const api = addComponent(
      newDoc(ctx),
      { type: 'service', label: 'API', position: { x: 100, y: 100 } },
      ctx,
    );
    const db = addComponent(
      api.doc,
      { type: 'database', label: 'DB', position: { x: 400, y: 100 } },
      ctx,
    );
    const far = addComponent(
      db.doc,
      { type: 'cache', label: 'Far', position: { x: 2000, y: 2000 } },
      ctx,
    );
    let doc = addDrawing(
      far.doc,
      {
        ...buildDrawing('rounded-rectangle', { x: 50, y: 50 }, { x: 600, y: 250 }, [], style),
        text: 'Private subnet',
        dashed: true,
        stroke: '#e03131',
      },
      ctx,
    ).doc;
    doc = addDrawing(
      doc,
      buildDrawing('arrow', { x: 190, y: 120 }, { x: 395, y: 120 }, [], style),
      ctx,
    ).doc;
    doc = addDrawing(
      doc,
      {
        ...buildDrawing('text', { x: 100, y: 150 }, { x: 101, y: 151 }, [], style),
        text: 'hot path',
      },
      ctx,
    ).doc;

    const snap = buildSnapshot(doc, await loadPack(), 'architecture-review', 'now');
    const notes = snap.architecture.annotations;
    const box = notes.find((n) => n.kind === 'rounded-rectangle');
    expect(box).toMatchObject({
      text: 'Private subnet',
      stroke: '#e03131',
      dashed: true,
      contains: [api.id, db.id],
    });
    expect(box?.contains).not.toContain(far.id);
    expect(notes.find((n) => n.kind === 'arrow')).toMatchObject({ from: api.id, to: db.id });
    expect(notes.find((n) => n.kind === 'text')).toMatchObject({
      text: 'hot path',
      near: [api.id],
    });
  });

  it('tracks drawings in change summaries by meaning, not by exact position', async () => {
    const ctx = makeCtx();
    const comp = addComponent(newDoc(ctx), { type: 'service', position: { x: 0, y: 0 } }, ctx);
    let doc = setReviewBaseline(comp.doc, takeBaseline(comp.doc, ctx.now()), ctx);
    const added = addDrawing(doc, { ...input, text: 'Trust boundary' }, ctx);
    doc = added.doc;
    expect(computeChanges(doc).entries.map((e) => `${e.kind} ${e.subject}: ${e.label}`)).toEqual([
      'added annotation: Trust boundary',
    ]);

    doc = setReviewBaseline(doc, takeBaseline(doc, ctx.now()), ctx);
    doc = moveComponents(doc, { [added.id]: { x: 5, y: 5 } }, ctx);
    doc = updateDrawings(doc, [added.id], { stroke: '#2f9e44' }, ctx);
    expect(computeChanges(doc).entries).toHaveLength(0);
    doc = updateDrawings(doc, [added.id], { text: 'Public zone' }, ctx);
    expect(computeChanges(doc).entries[0]).toMatchObject({
      kind: 'modified',
      subject: 'annotation',
    });
  });

  it('loads sessions saved before drawings existed', () => {
    const wire = JSON.parse(JSON.stringify(toRecord(newDoc())));
    delete wire.architecture.drawings;
    expect(fromRecord(wire).architecture.drawings).toEqual([]);
  });

  it('rejects unsafe colour values', () => {
    const bad = { ...input, id: 'd', stroke: 'url(javascript:alert(1))' };
    expect(DrawingSchema.safeParse(bad).success).toBe(false);
  });
});

describe('draw toolbar', () => {
  beforeEach(async () => {
    setRepositoriesForTesting({
      sessions: new MemorySessionRepository(),
      preferences: new MemoryPreferenceRepository(),
      durable: true,
    });
    useSessionStore.getState().open(newDoc(), await loadPack());
    useUiStore.setState({
      drawOpen: false,
      drawTool: 'select',
      drawStyle: DEFAULT_DRAW_STYLE,
      selectedNodeIds: [],
      selectedEdgeIds: [],
    });
  });

  it('opens from the Draw button and draws a shape by dragging', async () => {
    const user = userEvent.setup();
    render(<ArchitectureCanvas />);
    expect(screen.queryByRole('toolbar', { name: 'Drawing tools' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Draw' }));
    expect(screen.getByRole('toolbar', { name: 'Drawing tools' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rectangle' }));
    await user.click(screen.getByRole('button', { name: 'Stroke Red' }));
    const overlay = screen.getByTestId('draw-overlay');
    fireEvent.pointerDown(overlay, { clientX: 10, clientY: 10, pointerId: 1, button: 0 });
    fireEvent.pointerMove(overlay, { clientX: 110, clientY: 70, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 110, clientY: 70, pointerId: 1 });

    const drawings = useSessionStore.getState().doc?.architecture.drawings ?? [];
    expect(drawings).toHaveLength(1);
    expect(drawings[0]).toMatchObject({ kind: 'rectangle', stroke: '#e03131' });
    expect(useUiStore.getState().drawTool).toBe('select');
    expect(useUiStore.getState().selectedNodeIds).toEqual([drawings[0]?.id]);
  });

  it('applies colour changes to the selected drawing', async () => {
    const user = userEvent.setup();
    let id = '';
    useSessionStore.getState().apply((d) => {
      const r = addDrawing(d, buildDrawing('circle', { x: 0, y: 0 }, { x: 50, y: 50 }, [], style));
      id = r.id;
      return r.doc;
    });
    useUiStore.setState({ drawOpen: true });
    render(<ArchitectureCanvas />);
    act(() => useUiStore.setState({ selectedNodeIds: [id] }));
    await user.click(screen.getByRole('button', { name: 'Fill Blue' }));
    expect(useSessionStore.getState().doc?.architecture.drawings[0]?.fill).toBe('#1971c2');
  });

  it('shows an inspector for a selected drawing with a delete action', async () => {
    const user = userEvent.setup();
    let id = '';
    useSessionStore.getState().apply((d) => {
      const r = addDrawing(d, {
        ...buildDrawing('text', { x: 0, y: 0 }, { x: 1, y: 1 }, [], style),
        text: 'Zone A',
      });
      id = r.id;
      return r.doc;
    });
    useUiStore.setState({ selectedNodeIds: [id] });
    render(<Inspector />);
    const text = screen.getByLabelText('Drawing text');
    await user.clear(text);
    await user.type(text, 'Zone B{Tab}');
    expect(useSessionStore.getState().doc?.architecture.drawings[0]?.text).toBe('Zone B');
    await user.click(screen.getByRole('button', { name: 'Delete drawing' }));
    expect(useSessionStore.getState().doc?.architecture.drawings).toHaveLength(0);
  });
});
