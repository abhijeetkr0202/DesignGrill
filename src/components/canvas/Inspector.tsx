import { COMPONENT_TYPE_LABELS } from '@/features/architecture/flow-adapter';
import {
  removeComponents,
  removeEdges,
  updateComponent,
  updateEdge,
} from '@/features/interview-session/commands';
import { useSessionStore } from '@/store/session-store';
import { useUiStore } from '@/store/ui-store';
import {
  COMMUNICATION_PATTERNS,
  COMPONENT_TYPES,
  type ArchEdge,
  type ArchNode,
  type CommunicationPattern,
  type ComponentType,
} from '@/types/session';
import { CommitText, LabeledField } from '@/components/shared/CommitText';
import { Button, fieldClass } from '@/components/shared/ui';

export function Inspector() {
  const selectedNodeIds = useUiStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useUiStore((s) => s.selectedEdgeIds);
  const architecture = useSessionStore((s) => s.doc?.architecture);
  const decisions = useSessionStore((s) => s.doc?.decisions);
  if (!architecture) return null;

  const total = selectedNodeIds.length + selectedEdgeIds.length;
  const node =
    selectedNodeIds.length === 1 && total === 1
      ? architecture.nodes.find((n) => n.id === selectedNodeIds[0])
      : undefined;
  const edge =
    selectedEdgeIds.length === 1 && total === 1
      ? architecture.edges.find((e) => e.id === selectedEdgeIds[0])
      : undefined;

  if (node)
    return (
      <NodeForm
        node={node}
        decisionTitles={(decisions ?? [])
          .filter((d) => node.relatedDecisionIds.includes(d.id))
          .map((d) => d.title)}
      />
    );
  if (edge) {
    const label = (id: string) => architecture.nodes.find((n) => n.id === id)?.label ?? 'Unknown';
    return (
      <EdgeForm edge={edge} sourceLabel={label(edge.source)} targetLabel={label(edge.target)} />
    );
  }
  return (
    <div className="p-3 text-xs text-muted">
      {total > 1
        ? `${total} items selected. Select a single component or connection to edit its properties.`
        : 'Select a component or connection to edit its properties.'}
    </div>
  );
}

function NodeForm({ node, decisionTitles }: { node: ArchNode; decisionTitles: string[] }) {
  const patch = (p: Partial<ArchNode>) =>
    useSessionStore.getState().apply((d) => updateComponent(d, node.id, p));
  const text = (key: keyof ArchNode, label: string, multiline = true, placeholder?: string) => (
    <LabeledField label={label}>
      <CommitText
        label={label}
        multiline={multiline}
        rows={2}
        placeholder={placeholder}
        value={(node[key] as string | undefined) ?? ''}
        onCommit={(v) => patch({ [key]: v.trim() || undefined })}
      />
    </LabeledField>
  );
  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Component</h3>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            useSessionStore.getState().apply((d) => removeComponents(d, [node.id]));
            useUiStore.getState().clearSelection();
          }}
        >
          Delete component
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <LabeledField label="Label">
          <CommitText
            label="Label"
            value={node.label}
            maxLength={300}
            onCommit={(v) => v.trim() && patch({ label: v.trim() })}
          />
        </LabeledField>
        <LabeledField label="Type">
          <select
            className={fieldClass}
            value={node.type}
            onChange={(e) => patch({ type: e.target.value as ComponentType })}
          >
            {COMPONENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {COMPONENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </LabeledField>
        {text('technologies', 'Technologies', false, 'e.g. Redis, PostgreSQL')}
        {text('responsibility', 'Responsibility')}
        {text('configuration', 'Configuration and assumptions')}
        {text('bottlenecks', 'Potential bottlenecks')}
        {text('failureBehavior', 'Failure behaviour')}
        {text('scalingStrategy', 'Scaling strategy')}
        {text('description', 'Notes')}
      </div>
      {decisionTitles.length > 0 && (
        <p className="mt-2 text-[11px] text-muted">
          Related decisions: {decisionTitles.join(', ')}
        </p>
      )}
    </div>
  );
}

function EdgeForm({
  edge,
  sourceLabel,
  targetLabel,
}: {
  edge: ArchEdge;
  sourceLabel: string;
  targetLabel: string;
}) {
  const patch = (p: Partial<ArchEdge>) =>
    useSessionStore.getState().apply((d) => updateEdge(d, edge.id, p));
  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
          Connection: {sourceLabel} → {targetLabel}
        </h3>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            useSessionStore.getState().apply((d) => removeEdges(d, [edge.id]));
            useUiStore.getState().clearSelection();
          }}
        >
          Delete connection
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <LabeledField label="Label">
          <CommitText
            label="Label"
            value={edge.label ?? ''}
            maxLength={300}
            placeholder="e.g. GET /{code}"
            onCommit={(v) => patch({ label: v.trim() || undefined })}
          />
        </LabeledField>
        <LabeledField label="Protocol or transport">
          <CommitText
            label="Protocol"
            value={edge.protocol ?? ''}
            maxLength={300}
            placeholder="e.g. HTTPS, gRPC, TCP"
            onCommit={(v) => patch({ protocol: v.trim() || undefined })}
          />
        </LabeledField>
        <LabeledField label="Communication pattern">
          <select
            className={fieldClass}
            value={edge.pattern ?? ''}
            onChange={(e) =>
              patch({ pattern: (e.target.value || undefined) as CommunicationPattern | undefined })
            }
          >
            <option value="">Unspecified</option>
            {COMMUNICATION_PATTERNS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </LabeledField>
        <LabeledField label="Synchronous or asynchronous">
          <select
            className={fieldClass}
            value={edge.mode ?? ''}
            onChange={(e) => patch({ mode: (e.target.value || undefined) as ArchEdge['mode'] })}
          >
            <option value="">Unspecified</option>
            <option value="sync">Synchronous</option>
            <option value="async">Asynchronous</option>
          </select>
        </LabeledField>
        <div className="col-span-2">
          <LabeledField label="Payload or data flow">
            <CommitText
              label="Data flow"
              multiline
              rows={2}
              value={edge.dataFlow ?? ''}
              onCommit={(v) => patch({ dataFlow: v.trim() || undefined })}
            />
          </LabeledField>
        </div>
      </div>
    </div>
  );
}
