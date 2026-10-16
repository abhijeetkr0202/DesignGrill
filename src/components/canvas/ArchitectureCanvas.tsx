import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  copySelection,
  deleteSelection,
  pasteFromClipboard,
} from '@/features/architecture/canvas-actions';
import { buildDrawing } from '@/features/architecture/drawing-geometry';
import {
  COMPONENT_TYPE_LABELS,
  toFlowEdges,
  toFlowNodes,
  type AppFlowNode,
} from '@/features/architecture/flow-adapter';
import {
  addComponent,
  addDrawing,
  connectComponents,
  moveComponents,
  removeComponents,
  removeDrawings,
  removeEdges,
  type DrawingInput,
} from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { useClipboardStore } from '@/store/clipboard-store';
import { useUiStore } from '@/store/ui-store';
import { ContextMenu, MOD_KEY, type MenuItem } from '@/components/shared/ContextMenu';
import { COMPONENT_TYPES, type ComponentType } from '@/types/session';
import { ComponentNode } from './ComponentNode';
import { ComponentShape } from './ComponentShape';
import { DrawOverlay } from './DrawOverlay';
import { DrawToolbar } from './DrawToolbar';
import { DrawingNode } from './DrawingNode';

const nodeTypes = { component: ComponentNode, drawing: DrawingNode };

interface MenuState {
  x: number;
  y: number;
  kind: 'selection' | 'pane' | 'edge';
  flow?: { x: number; y: number };
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
}

export function ArchitectureCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

function CanvasInner() {
  const architecture = useSessionStore((s) => s.doc?.architecture);
  const theme = useUiStore((s) => s.theme);
  const focusIds = useUiStore((s) => s.focusNodeIds);
  const selectedEdgeIds = useUiStore((s) => s.selectedEdgeIds);
  const hasClipboard = useClipboardStore((s) => s.data !== null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const drawOpen = useUiStore((s) => s.drawOpen);
  const drawTool = useUiStore((s) => s.drawTool);
  const drawStyle = useUiStore((s) => s.drawStyle);
  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [nodes, setNodes] = useState<AppFlowNode[]>(() =>
    architecture
      ? toFlowNodes(
          architecture,
          new Set(focusIds),
          undefined,
          new Set(useUiStore.getState().selectedNodeIds),
        )
      : [],
  );
  const focusSet = useMemo(() => new Set(focusIds), [focusIds]);

  // Re-derive the view when the canonical model changes (edits, undo, load, paste).
  // Selection is read here rather than subscribed to: React Flow reports its own selection back,
  // and reacting to every report would ping-pong with it.
  useEffect(() => {
    if (!architecture) return;
    const selected = new Set(useUiStore.getState().selectedNodeIds);
    setNodes((prev) =>
      toFlowNodes(architecture, focusSet, new Map(prev.map((n) => [n.id, n] as const)), selected),
    );
  }, [architecture, focusSet]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || isEditable(e.target)) return;
      // Leave the browser's own copy alone when text is highlighted.
      if (window.getSelection()?.toString()) return;
      const key = e.key.toLowerCase();
      const handled =
        key === 'c'
          ? copySelection()
          : key === 'x'
            ? copySelection({ cut: true })
            : key === 'v'
              ? pasteFromClipboard()
              : false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const edges: Edge[] = useMemo(
    () => (architecture ? toFlowEdges(architecture, new Set(selectedEdgeIds)) : []),
    [architecture, selectedEdgeIds],
  );

  const onNodesChange = useCallback((changes: NodeChange<AppFlowNode>[]) => {
    // Removal is handled through onNodesDelete so the domain model stays the source of truth.
    const allowed = changes.filter((c) => c.type !== 'remove');
    if (allowed.length) setNodes((ns) => applyNodeChanges(allowed, ns));
  }, []);

  const onNodeDragStop = useCallback((_: unknown, __: unknown, dragged: AppFlowNode[]) => {
    const positions = Object.fromEntries(dragged.map((n) => [n.id, n.position]));
    useSessionStore.getState().apply((d) => moveComponents(d, positions));
  }, []);

  const onConnect = useCallback((c: Connection) => {
    useSessionStore.getState().apply(
      (d) =>
        connectComponents(d, {
          source: c.source,
          target: c.target,
          sourceHandle: c.sourceHandle ?? undefined,
          targetHandle: c.targetHandle ?? undefined,
        }).doc,
    );
  }, []);

  const onNodesDelete = useCallback((deleted: AppFlowNode[]) => {
    const ids = deleted.map((n) => n.id);
    useSessionStore.getState().apply((d) => removeDrawings(removeComponents(d, ids), ids));
    useUiStore.getState().clearSelection();
  }, []);

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    const ids = deleted.map((e) => e.id);
    useSessionStore.getState().apply((d) => removeEdges(d, ids));
  }, []);

  const onSelectionChange = useCallback(({ nodes: ns, edges: es }: OnSelectionChangeParams) => {
    useUiStore.getState().setSelection(
      ns.map((n) => n.id),
      es.map((e) => e.id),
    );
  }, []);

  const add = (type: ComponentType) => {
    const box = wrapper.current?.getBoundingClientRect();
    const center = box
      ? screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
      : { x: 0, y: 0 };
    const count = useSessionStore.getState().doc?.architecture.nodes.length ?? 0;
    const offset = (count % 6) * 28;
    let newId = '';
    useSessionStore.getState().apply((d) => {
      const r = addComponent(d, {
        type,
        position: { x: center.x - 48 + offset, y: center.y - 22 + offset },
      });
      newId = r.id;
      return r.doc;
    });
    useUiStore.getState().setSelection([newId], []);
  };

  const onNodeContextMenu = useCallback((e: MouseEvent, node: AppFlowNode) => {
    e.preventDefault();
    const ui = useUiStore.getState();
    if (!ui.selectedNodeIds.includes(node.id)) ui.setSelection([node.id], []);
    setMenu({ x: e.clientX, y: e.clientY, kind: 'selection' });
  }, []);

  const onSelectionContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, kind: 'selection' });
  }, []);

  const onEdgeContextMenu = useCallback((e: MouseEvent, edge: Edge) => {
    e.preventDefault();
    useUiStore.getState().setSelection([], [edge.id]);
    setMenu({ x: e.clientX, y: e.clientY, kind: 'edge' });
  }, []);

  const onPaneContextMenu = useCallback(
    (e: MouseEvent | globalThis.MouseEvent) => {
      e.preventDefault();
      setMenu({
        x: e.clientX,
        y: e.clientY,
        kind: 'pane',
        flow: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      });
    },
    [screenToFlowPosition],
  );

  const menuItems = (m: MenuState): MenuItem[] => {
    const paste: MenuItem = {
      label: 'Paste',
      shortcut: `${MOD_KEY}V`,
      disabled: !hasClipboard,
      onSelect: () => void pasteFromClipboard(m.kind === 'pane' ? m.flow : undefined),
    };
    const del: MenuItem = {
      label: 'Delete',
      shortcut: 'Del',
      danger: true,
      onSelect: () => void deleteSelection(),
    };
    if (m.kind === 'edge') return [del];
    if (m.kind === 'pane') return [paste];
    return [
      { label: 'Cut', shortcut: `${MOD_KEY}X`, onSelect: () => void copySelection({ cut: true }) },
      { label: 'Copy', shortcut: `${MOD_KEY}C`, onSelect: () => void copySelection() },
      paste,
      del,
    ];
  };

  const createDrawing = (input: DrawingInput) => {
    let newId = '';
    useSessionStore.getState().apply((d) => {
      const r = addDrawing(d, input);
      newId = r.id;
      return r.doc;
    });
    useUiStore.getState().setSelection([newId], []);
    useUiStore.getState().setDrawTool('select');
    return newId;
  };

  // Double-clicking empty canvas drops a note and lets you type straight away.
  const onCanvasDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).classList.contains('react-flow__pane')) return;
    const at = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const { drawStyle: s } = useUiStore.getState();
    const note = buildDrawing('text', at, at, [], { ...s, fill: 'none', dashed: false });
    const id = createDrawing({ ...note, width: 200, height: 60 });
    useUiStore.getState().setEditingDrawing(id);
  };

  if (!architecture) return null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="toolbar"
        aria-label="Add components"
        className="flex flex-wrap items-center gap-1 border-b border-line bg-surface px-2 py-1.5"
      >
        <span className="mr-1 text-[11px] font-medium text-muted">Add</span>
        {COMPONENT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => add(t)}
            className="flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-0.5 text-xs hover:bg-line"
          >
            <ComponentShape type={t} className="h-3.5 w-5 shrink-0" />
            {COMPONENT_TYPE_LABELS[t]}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={drawOpen}
          onClick={() => useUiStore.getState().setDrawOpen(!drawOpen)}
          className={`ml-2 rounded border px-2 py-0.5 text-xs ${drawOpen ? 'border-accent text-accent' : 'border-line hover:bg-surface-2'}`}
        >
          Draw
        </button>
        <button
          type="button"
          onClick={() => void fitView({ padding: 0.2, duration: 200 })}
          className="ml-auto rounded border border-line px-2 py-0.5 text-xs hover:bg-surface-2"
        >
          Fit view
        </button>
      </div>
      {drawOpen && <DrawToolbar />}
      <div
        ref={wrapper}
        className="relative min-h-0 flex-1"
        aria-label="Architecture canvas"
        onDoubleClick={onCanvasDoubleClick}
      >
        {architecture.nodes.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/3 z-10 text-center text-xs text-muted">
            Add components above, then drag from one node&rsquo;s edge to another to connect them.
            Double-click anywhere to write a note.
          </p>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode={theme}
          connectionMode={ConnectionMode.Loose}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onSelectionChange={onSelectionChange}
          onNodeContextMenu={onNodeContextMenu}
          onSelectionContextMenu={onSelectionContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          deleteKeyCode={['Backspace', 'Delete']}
          elevateNodesOnSelect={false}
          zoomOnDoubleClick={false}
          fitView
          minZoom={0.2}
          maxZoom={2}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
          {architecture.nodes.length > 5 && (
            <MiniMap pannable zoomable ariaLabel="Architecture minimap" />
          )}
        </ReactFlow>
        {drawOpen && drawTool !== 'select' && (
          <DrawOverlay kind={drawTool} style={drawStyle} onCreate={createDrawing} />
        )}
        {menu && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            label={menu.kind === 'pane' ? 'Canvas actions' : 'Selection actions'}
            items={menuItems(menu)}
            onClose={() => setMenu(null)}
          />
        )}
      </div>
    </div>
  );
}
