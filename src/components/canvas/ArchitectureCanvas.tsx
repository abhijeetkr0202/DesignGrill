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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  COMPONENT_TYPE_LABELS,
  toFlowEdges,
  toFlowNodes,
  type ComponentFlowNode,
} from '@/features/architecture/flow-adapter';
import {
  addComponent,
  connectComponents,
  moveComponents,
  removeComponents,
  removeEdges,
} from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import { COMPONENT_TYPES, type ComponentType } from '@/types/session';
import { ComponentNode } from './ComponentNode';

const nodeTypes = { component: ComponentNode };

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
  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [nodes, setNodes] = useState<ComponentFlowNode[]>(() =>
    architecture ? toFlowNodes(architecture, new Set(focusIds)) : [],
  );
  const focusSet = useMemo(() => new Set(focusIds), [focusIds]);

  // Re-derive the view whenever the canonical model changes (edits, undo, load).
  useEffect(() => {
    if (!architecture) return;
    setNodes((prev) =>
      toFlowNodes(architecture, focusSet, new Map(prev.map((n) => [n.id, n] as const))),
    );
  }, [architecture, focusSet]);

  const edges: Edge[] = useMemo(
    () => (architecture ? toFlowEdges(architecture, new Set(selectedEdgeIds)) : []),
    [architecture, selectedEdgeIds],
  );

  const onNodesChange = useCallback((changes: NodeChange<ComponentFlowNode>[]) => {
    // Removal is handled through onNodesDelete so the domain model stays the source of truth.
    const allowed = changes.filter((c) => c.type !== 'remove');
    if (allowed.length) setNodes((ns) => applyNodeChanges(allowed, ns));
  }, []);

  const onNodeDragStop = useCallback((_: unknown, __: unknown, dragged: ComponentFlowNode[]) => {
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

  const onNodesDelete = useCallback((deleted: ComponentFlowNode[]) => {
    const ids = deleted.map((n) => n.id);
    useSessionStore.getState().apply((d) => removeComponents(d, ids));
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
        position: { x: center.x - 60 + offset, y: center.y - 30 + offset },
      });
      newId = r.id;
      return r.doc;
    });
    useUiStore.getState().setSelection([newId], []);
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
            className="rounded border border-line bg-surface-2 px-2 py-0.5 text-xs hover:bg-line"
          >
            {COMPONENT_TYPE_LABELS[t]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void fitView({ padding: 0.2, duration: 200 })}
          className="ml-auto rounded border border-line px-2 py-0.5 text-xs hover:bg-surface-2"
        >
          Fit view
        </button>
      </div>
      <div ref={wrapper} className="relative min-h-0 flex-1" aria-label="Architecture canvas">
        {architecture.nodes.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/3 z-10 text-center text-xs text-muted">
            Add components above, then drag from one node&rsquo;s edge to another to connect them.
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
          deleteKeyCode={['Backspace', 'Delete']}
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
      </div>
    </div>
  );
}
