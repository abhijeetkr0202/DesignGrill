import { useMemo, useState } from 'react';
import { buildSystemPrompt } from '@/ai/prompts';
import {
  SNAPSHOT_LIMIT_CHARS,
  buildSnapshotDetailed,
  snapshotToUserMessage,
} from '@/features/design-review/snapshot';
import type { ProblemPack } from '@/features/problem-library/schema';
import type { InterviewMode, SessionDocument } from '@/types/session';
import { defaultContext } from '@/utils/context';
import { fieldClass } from '@/components/shared/ui';

const PREVIEW_MODES: { mode: InterviewMode; label: string }[] = [
  { mode: 'architecture-review', label: 'Review architecture' },
  { mode: 'architecture-interview', label: 'Ask me a question' },
  { mode: 'requirements-discovery', label: 'Discover requirements' },
  { mode: 'failure-scenario', label: 'Failure scenario' },
];

// Rough rule of thumb for English and JSON; real tokenizers differ by model.
const approxTokens = (chars: number) => Math.ceil(chars / 4);

export function AiContextPreview({
  doc,
  pack,
  isCustomEndpoint,
}: {
  doc: SessionDocument;
  pack: ProblemPack | null;
  isCustomEndpoint: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<InterviewMode>('architecture-review');

  // Built only while expanded so a collapsed panel costs nothing on every edit.
  const request = useMemo(() => {
    if (!open || !pack) return null;
    const system = buildSystemPrompt(mode);
    const built = buildSnapshotDetailed(doc, pack, mode, defaultContext.now());
    const user = snapshotToUserMessage(built.snapshot);
    return { system, user, trimmed: built.trimmed };
  }, [open, pack, doc, mode]);

  return (
    <details className="text-[11px] text-muted" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer">What the AI sees</summary>
      {request && (
        <div className="mt-1 space-y-2">
          <label className="block">
            <span className="mb-0.5 block font-medium">Preview for action</span>
            <select
              className={fieldClass}
              value={mode}
              onChange={(e) => setMode(e.target.value as InterviewMode)}
            >
              {PREVIEW_MODES.map((m) => (
                <option key={m.mode} value={m.mode}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <p>
            Instructions {request.system.length.toLocaleString()} characters + design snapshot{' '}
            {request.user.length.toLocaleString()} characters, about{' '}
            {approxTokens(request.system.length + request.user.length).toLocaleString()} tokens
            (estimate). When you reply to a question, your answer is added to the snapshot.
            {isCustomEndpoint &&
              ' If your server context window is smaller than this, the start of the request, which holds the instructions, can be cut off silently.'}
          </p>
          {request.trimmed.length > 0 && (
            <p className="text-warn">
              Shortened to fit the {SNAPSHOT_LIMIT_CHARS.toLocaleString()} character limit:{' '}
              {request.trimmed.join('; ')}.
            </p>
          )}
          <PreviewBlock title="Instructions (system prompt)" text={request.system} />
          <PreviewBlock title="Your design as sent (snapshot)" text={request.user} />
        </div>
      )}
    </details>
  );
}

function PreviewBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-0.5 font-medium">{title}</div>
      <pre
        tabIndex={0}
        aria-label={title}
        className="max-h-56 overflow-auto rounded border border-line bg-surface-2 p-1.5 font-mono text-[10px] leading-snug whitespace-pre-wrap text-fg"
      >
        {text}
      </pre>
    </div>
  );
}
