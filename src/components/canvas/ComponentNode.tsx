import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import {
  COMPONENT_TYPE_LABELS,
  type ComponentFlowNode,
} from '@/features/architecture/flow-adapter';

const GLYPHS: Record<string, string> = {
  client: '▭',
  'load-balancer': '⇄',
  'api-gateway': '⛩',
  service: '⚙',
  database: '▤',
  cache: '⚡',
  queue: '≡',
  'object-storage': '▦',
  'search-index': '⌕',
  'external-provider': '☁',
  custom: '◇',
};

function ComponentNodeView({ data, selected }: NodeProps<ComponentFlowNode>) {
  return (
    <div
      className={`min-w-32 rounded-md border bg-surface px-3 py-2 text-fg shadow-sm ${
        selected ? 'border-accent ring-1 ring-accent' : 'border-line'
      } ${data.flagged ? 'outline-2 outline-offset-2 outline-warn' : ''}`}
    >
      {(['Top', 'Right', 'Bottom', 'Left'] as const).map((side) => (
        <Handle key={side} id={side} type="source" position={Position[side]} />
      ))}
      <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted uppercase">
        <span aria-hidden>{GLYPHS[data.kind]}</span>
        {COMPONENT_TYPE_LABELS[data.kind]}
      </div>
      <div className="mt-0.5 text-[13px] font-semibold">{data.label}</div>
      {data.subtitle && <div className="text-[11px] text-muted">{data.subtitle}</div>}
    </div>
  );
}

export const ComponentNode = memo(ComponentNodeView);
