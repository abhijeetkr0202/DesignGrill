import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ArchitectureCanvas } from '@/components/canvas/ArchitectureCanvas';
import {
  MemoryPreferenceRepository,
  MemorySessionRepository,
} from '@/data/repositories/memory-repository';
import { setRepositoriesForTesting } from '@/data/repositories';
import {
  addComponent,
  addDrawing,
  clipboardBounds,
  collectClipboard,
  connectComponents,
  pasteClipboard,
  recordDecision,
} from '@/features/interview-session/commands';
import { buildDrawing, DEFAULT_DRAW_STYLE } from '@/features/architecture/drawing-geometry';
import { useClipboardStore } from '@/store/clipboard-store';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { loadPack, makeCtx, newDoc } from './helpers';

function twoTier() {
  const ctx = makeCtx();
  const api = addComponent(
    newDoc(ctx),
    { type: 'service', label: 'API', position: { x: 0, y: 0 } },
    ctx,
  );
  const db = addComponent(
    api.doc,
    { type: 'database', label: 'DB', position: { x: 200, y: 0 } },
    ctx,
  );
  const other = addComponent(
    db.doc,
    { type: 'cache', label: 'Cache', position: { x: 400, y: 0 } },
    ctx,
  );
  const linked = connectComponents(other.doc, { source: api.id, target: db.id, label: 'SQL' }, ctx);
  const outside = connectComponents(linked.doc, { source: db.id, target: other.id }, ctx);
  const dec = recordDecision(outside.doc, { title: 'Use SQL', relatedNodeIds: [api.id] }, ctx);
  return { ctx, doc: dec.doc, ids: { api: api.id, db: db.id, cache: other.id } };
}

describe('clipboard commands', () => {
  it('copies selected components with only the connections between them', () => {
    const { doc, ids } = twoTier();
    const data = collectClipboard(doc, [ids.api, ids.db])!;
    expect(data.nodes.map((n) => n.label)).toEqual(['API', 'DB']);
    expect(data.edges).toHaveLength(1);
    expect(collectClipboard(doc, [ids.db, ids.cache])!.edges).toHaveLength(1);
    expect(collectClipboard(doc, [ids.api, ids.cache])!.edges).toHaveLength(0);
    expect(collectClipboard(doc, [])).toBeNull();
  });

  it('pastes independent replicas with new ids, remapped connections and an offset', () => {
    const { doc, ctx, ids } = twoTier();
    const data = collectClipboard(doc, [ids.api, ids.db])!;
    const pasted = pasteClipboard(doc, data, { dx: 0, dy: 100 }, ctx);

    expect(pasted.doc.architecture.nodes).toHaveLength(5);
    const copies = pasted.doc.architecture.nodes.slice(3);
    expect(copies.map((n) => [n.label, n.position])).toEqual([
      ['API', { x: 0, y: 100 }],
      ['DB', { x: 200, y: 100 }],
    ]);
    expect(copies.some((n) => [ids.api, ids.db].includes(n.id))).toBe(false);
    expect(copies[0]!.relatedDecisionIds).toEqual([]);

    const newEdge = pasted.doc.architecture.edges.at(-1)!;
    expect(newEdge).toMatchObject({ source: copies[0]!.id, target: copies[1]!.id, label: 'SQL' });
    expect(pasted.doc.architecture.edges).toHaveLength(3);
    expect(pasted.ids).toEqual(copies.map((n) => n.id));
    expect(pasted.doc.revision).toBeGreaterThan(doc.revision);
  });

  it('copies drawings too and can be pasted repeatedly', () => {
    const { doc, ctx, ids } = twoTier();
    const withDrawing = addDrawing(
      doc,
      {
        ...buildDrawing(
          'rectangle',
          { x: -20, y: -20 },
          { x: 300, y: 100 },
          [],
          DEFAULT_DRAW_STYLE,
        ),
        text: 'AZ-1',
      },
      ctx,
    );
    const data = collectClipboard(withDrawing.doc, [ids.api, withDrawing.id])!;
    expect(clipboardBounds(data)).toEqual({ x: -20, y: -20 });
    const once = pasteClipboard(withDrawing.doc, data, { dx: 10, dy: 10 }, ctx);
    const twice = pasteClipboard(once.doc, data, { dx: 20, dy: 20 }, ctx);
    expect(twice.doc.architecture.drawings).toHaveLength(3);
    expect(new Set(twice.doc.architecture.nodes.map((n) => n.id)).size).toBe(5);
  });
});

describe('canvas shortcuts and context menu', () => {
  let apiId = '';
  let dbId = '';

  beforeEach(async () => {
    setRepositoriesForTesting({
      sessions: new MemorySessionRepository(),
      preferences: new MemoryPreferenceRepository(),
      durable: true,
    });
    const { doc, ids } = twoTier();
    apiId = ids.api;
    dbId = ids.db;
    useSessionStore.getState().open(doc, await loadPack());
    useClipboardStore.setState({ data: null, pasteCount: 0 });
    useUiStore.setState({ selectedNodeIds: [apiId, dbId], selectedEdgeIds: [] });
  });

  const nodes = () => useSessionStore.getState().doc!.architecture.nodes;
  const press = (key: string, init: object = {}) =>
    fireEvent.keyDown(window, { key, ctrlKey: true, ...init });

  it('copy then paste with Ctrl+C and Ctrl+V cascades copies diagonally', () => {
    render(<ArchitectureCanvas />);
    act_selection([apiId, dbId]);
    press('c');
    press('v');
    expect(nodes()).toHaveLength(5);
    expect(nodes()[3]!.position).toEqual({ x: 32, y: 32 });
    expect(useUiStore.getState().selectedNodeIds).toEqual([nodes()[3]!.id, nodes()[4]!.id]);
    press('v');
    expect(nodes()).toHaveLength(7);
    expect(nodes()[5]!.position).toEqual({ x: 64, y: 64 });
  });

  it('cut removes the components and pastes them back in place', () => {
    render(<ArchitectureCanvas />);
    act_selection([apiId, dbId]);
    press('x');
    expect(nodes().map((n) => n.label)).toEqual(['Cache']);
    expect(useSessionStore.getState().doc!.architecture.edges).toHaveLength(0);
    press('v');
    expect(nodes().map((n) => n.label)).toEqual(['Cache', 'API', 'DB']);
    expect(nodes()[1]!.position).toEqual({ x: 0, y: 0 });
  });

  it('ignores shortcuts while typing and with nothing selected', () => {
    render(<ArchitectureCanvas />);
    act_selection([]);
    press('c');
    expect(useClipboardStore.getState().data).toBeNull();
    act_selection([apiId]);
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'c', ctrlKey: true });
    expect(useClipboardStore.getState().data).toBeNull();
    input.remove();
  });

  it('offers Cut, Copy, Paste and Delete on a right-clicked component', () => {
    const { container } = render(<ArchitectureCanvas />);
    const node = container.querySelector(`[data-id="${apiId}"]`)!;
    fireEvent.contextMenu(node, { clientX: 50, clientY: 60 });

    const menu = screen.getByRole('menu', { name: 'Selection actions' });
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((i) => i.textContent?.replace(/(Ctrl\+|\u2318).*|Del$/, ''))).toEqual([
      'Cut',
      'Copy',
      'Paste',
      'Delete',
    ]);
    expect(within(menu).getByRole('menuitem', { name: /Paste/ })).toBeDisabled();

    fireEvent.click(within(menu).getByRole('menuitem', { name: /Copy/ }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(useClipboardStore.getState().data).not.toBeNull();
  });

  it('pastes at the pointer from the canvas menu and deletes from the component menu', () => {
    const { container } = render(<ArchitectureCanvas />);
    act_selection([apiId]);
    press('c');

    fireEvent.contextMenu(container.querySelector('.react-flow__pane')!, {
      clientX: 300,
      clientY: 300,
    });
    fireEvent.click(screen.getByRole('menuitem', { name: /Paste/ }));
    expect(nodes()).toHaveLength(4);

    fireEvent.contextMenu(container.querySelector(`[data-id="${dbId}"]`)!, {
      clientX: 5,
      clientY: 5,
    });
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(nodes().some((n) => n.id === dbId)).toBe(false);
  });
});

function act_selection(ids: string[]) {
  useUiStore.setState({ selectedNodeIds: ids, selectedEdgeIds: [] });
}
