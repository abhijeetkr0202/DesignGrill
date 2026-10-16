import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Architecture, ArchEdge, ArchNode, ComponentType } from '@/types/session';

export interface ComponentNodeData extends Record<string, unknown> {
  label: string;
  kind: ComponentType;
  subtitle?: string;
  flagged: boolean;
}
export type ComponentFlowNode = Node<ComponentNodeData, 'component'>;

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
export function toFlowNodes(
  arch: Architecture,
  flagged: ReadonlySet<string>,
  previous: ReadonlyMap<string, ComponentFlowNode> = new Map(),
): ComponentFlowNode[] {
  return arch.nodes.map((n: ArchNode) => {
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
      selected: old?.selected,
      measured: old?.measured,
    };
  });
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
