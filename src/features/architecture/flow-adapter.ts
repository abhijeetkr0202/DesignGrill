import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Architecture, ArchEdge, ArchNode, ComponentType, Drawing } from '@/types/session';
import { isBackdropKind } from './drawing-geometry';

export interface ComponentNodeData extends Record<string, unknown> {
  label: string;
  kind: ComponentType;
  subtitle?: string;
  flagged: boolean;
}
export type ComponentFlowNode = Node<ComponentNodeData, 'component'>;

export interface DrawingNodeData extends Record<string, unknown> {
  drawing: Drawing;
}
export type DrawingFlowNode = Node<DrawingNodeData, 'drawing'>;
export type AppFlowNode = ComponentFlowNode | DrawingFlowNode;

export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  client: 'Client',
  'load-balancer': 'Load balancer',
  'api-gateway': 'API gateway',
  service: 'Service',
  database: 'Database',
  cache: 'Cache',
  queue: 'Queue',
  'object-storage': 'Object storage',
  'search-index': 'Search index',
  'external-provider': 'External provider',
  custom: 'Custom',
};

// React Flow's node shape is derived from the domain model and never persisted directly.
// Array order is paint order: backdrop shapes, then components, then lines, text and pen strokes.
export function toFlowNodes(
  arch: Architecture,
  flagged: ReadonlySet<string>,
  previous: ReadonlyMap<string, AppFlowNode> = new Map(),
  selected?: ReadonlySet<string>,
): AppFlowNode[] {
  const isSelected = (id: string) => (selected ? selected.has(id) : previous.get(id)?.selected);
  const components = arch.nodes.map((n: ArchNode): ComponentFlowNode => {
    const old = previous.get(n.id);
    return {
      id: n.id,
      type: 'component',
      position: n.position,
      data: {
        label: n.label,
        kind: n.type,
        subtitle: n.technologies,
        flagged: flagged.has(n.id),
      },
      selected: isSelected(n.id),
      measured: old?.measured,
    };
  });
  const drawing = (d: Drawing): DrawingFlowNode => ({
    id: d.id,
    type: 'drawing',
    position: { x: d.x, y: d.y },
    width: d.width,
    height: d.height,
    data: { drawing: d },
    selected: isSelected(d.id),
  });
  return [
    ...arch.drawings.filter((d) => isBackdropKind(d.kind)).map(drawing),
    ...components,
    ...arch.drawings.filter((d) => !isBackdropKind(d.kind)).map(drawing),
  ];
}

export function toFlowEdges(arch: Architecture, selected: ReadonlySet<string>): Edge[] {
  return arch.edges.map((e: ArchEdge) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label || e.protocol || undefined,
    animated: e.mode === 'async',
    style: e.mode === 'async' ? { strokeDasharray: '6 4' } : undefined,
    markerEnd: { type: MarkerType.ArrowClosed },
    selected: selected.has(e.id),
    interactionWidth: 24,
  }));
}
