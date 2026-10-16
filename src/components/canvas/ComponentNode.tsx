import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import type { ComponentFlowNode } from '@/features/architecture/flow-adapter';
import { updateComponent } from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { ComponentShape, shapeBox } from './ComponentShape';
import { InlineEdit } from './InlineEdit';

function ComponentNodeView({ id, data, selected }: NodeProps<ComponentFlowNode>) {
  const patch = (p: { label: string } | { technologies: string | undefined }) =>
    useSessionStore.getState().apply((d) => updateComponent(d, id, p));
  return (
    <div
      className="relative flex flex-col items-center justify-center gap-0.5 text-center"
      style={shapeBox(data.kind)}
    >
      <ComponentShape type={data.kind} selected={selected} flagged={data.flagged} />
      {(['Top', 'Right', 'Bottom', 'Left'] as const).map((side) => (
        <Handle key={side} id={side} type="source" position={Position[side]} />
      ))}
      <InlineEdit
        label="Component label"
        value={data.label}
        className="line-clamp-2 max-w-full text-[9px] leading-tight font-semibold text-fg"
        onCommit={(v) => v.trim() && patch({ label: v.trim() })}
      />
      {data.subtitle && (
        <InlineEdit
          label="Technologies"
          value={data.subtitle}
          className="max-w-full truncate text-[7px] text-muted"
          onCommit={(v) => patch({ technologies: v.trim() || undefined })}
        />
      )}
    </div>
  );
}

export const ComponentNode = memo(ComponentNodeView);
