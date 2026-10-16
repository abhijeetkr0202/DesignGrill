import { useEffect, useRef, useState } from 'react';
import { PROVIDER_INFO } from '@/ai/provider-registry';
import { useUiStore } from '@/store/ui-store';
import { getInterviewService, useAiStore } from '@/features/interview-session/ai-store';
import { useChangeSummary } from '@/features/design-review/use-change-summary';
import { useSettingsStore } from '@/features/settings/settings-store';
import { useSessionStore } from '@/store/session-store';
import type { InterviewMode, Message } from '@/types/session';
import { Badge, Button, Notice, Spinner, fieldClass } from '@/components/shared/ui';

const ACTIONS: { mode: InterviewMode; label: string; hint: string }[] = [
  {
    mode: 'requirements-discovery',
    label: 'Discover requirements',
    hint: 'Get a question about the most important unknown.',
  },
  {
    mode: 'architecture-interview',
    label: 'Ask me a question',
    hint: 'A question grounded in your current design.',
  },
  {
    mode: 'architecture-review',
    label: 'Review architecture',
    hint: 'Structured findings against your requirements.',
  },
  {
    mode: 'failure-scenario',
    label: 'Failure scenario',
    hint: 'A hypothetical incident to reason through.',
  },
];

const MODE_LABELS: Record<InterviewMode, string> = {
  'requirements-discovery': 'Requirements',
  'architecture-interview': 'Interview',
  'architecture-review': 'Review',
  'failure-scenario': 'Scenario',
  'session-summary': 'Summary',
};

export function InterviewerPanel() {
  const doc = useSessionStore((s) => s.doc);
  const ai = useAiStore((s) => s.state);
  const provider = useSettingsStore((s) => s.provider);
  const model = useSettingsStore((s) => s.models[s.provider]);
  const status = useSettingsStore((s) => s.providers[s.provider].status);
  const changes = useChangeSummary();
  const [answer, setAnswer] = useState('');
  const listEnd = useRef<HTMLDivElement>(null);
  const service = getInterviewService();
  const messageCount = doc?.messages.length ?? 0;

  useEffect(() => {
    listEnd.current?.scrollIntoView?.({ block: 'end' });
  }, [messageCount, ai.status]);

  if (!doc) return null;
  const running = ai.status === 'running';
  const hasKey = status !== 'no-key';
  const lastInterviewer = [...doc.messages].reverse().find((m) => m.role === 'interviewer');
  const outdated =
    lastInterviewer?.basedOnRevision !== undefined &&
    lastInterviewer.basedOnRevision < doc.revision;
  const info = PROVIDER_INFO[provider];

  const send = () => {
    const text = answer.trim();
    if (!text || running) return;
    setAnswer('');
    void service.submitAnswer(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-line p-2">
        {!hasKey && (
          <Notice
            tone="warn"
            action={
              <Button size="sm" onClick={() => useUiStore.getState().setView('settings')}>
                Open settings
              </Button>
            }
          >
            AI actions need an API key for {info.displayName}. You can keep designing locally
            without one.
          </Notice>
        )}
        <div className="flex flex-wrap gap-1.5">
          {ACTIONS.map((a) => (
            <Button
              key={a.mode}
              size="sm"
              variant={a.mode === 'architecture-review' ? 'primary' : 'secondary'}
              title={a.hint}
              disabled={running}
              onClick={() => void service.request(a.mode)}
            >
              {a.label}
            </Button>
          ))}
        </div>
        <details className="text-[11px] text-muted">
          <summary className="cursor-pointer">What is sent to {info.displayName}?</summary>
          <p className="mt-1">
            Each AI action sends your problem statement, requirements, architecture (components,
            connections, properties), design decisions, open findings, recent chat messages, and
            illustrative reference notes for this problem, directly to {info.displayName} using
            model <code>{model}</code>. Nothing is sent until you click an action or send an answer.
            Your API key never leaves the OS credential store and native layer.
          </p>
        </details>
        {changes?.significant && !running && (
          <Notice
            action={
              <Button size="sm" onClick={() => void service.request('architecture-review')}>
                Review changes
              </Button>
            }
          >
            Design changed since the last review: {changes.entries.length} change
            {changes.entries.length === 1 ? '' : 's'}.
            <ul className="mt-1 list-disc pl-4 text-muted">
              {changes.entries.slice(0, 4).map((c) => (
                <li key={`${c.subject}-${c.id}-${c.kind}`}>
                  {c.kind} {c.subject}: {c.label}
                </li>
              ))}
              {changes.entries.length > 4 && <li>and {changes.entries.length - 4} more</li>}
            </ul>
          </Notice>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2" aria-live="polite">
        {doc.messages.length === 0 && (
          <p className="p-2 text-xs text-muted">
            Start by writing requirements and sketching components. Then ask for a question or a
            review. The interviewer reads your actual requirements and architecture, not just the
            problem title.
          </p>
        )}
        <ul className="space-y-2">
          {doc.messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              outdated={outdated && m.id === lastInterviewer?.id}
            />
          ))}
        </ul>
        {running && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            <Spinner label="Waiting for the interviewer" />
            Interviewer is thinking. You can keep editing.
            <Button size="sm" onClick={() => service.cancel()}>
              Cancel
            </Button>
          </div>
        )}
        {ai.status === 'error' && ai.error && (
          <div className="mt-2">
            <Notice
              tone="danger"
              action={
                <Button size="sm" onClick={() => void service.retry()}>
                  Retry
                </Button>
              }
            >
              {ai.error.message}
            </Notice>
          </div>
        )}
        <div ref={listEnd} />
      </div>

      <form
        className="space-y-1.5 border-t border-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {doc.pendingQuestion && (
          <div className="rounded border border-accent px-2 py-1 text-xs">
            <span className="font-semibold">Waiting for your answer: </span>
            {doc.pendingQuestion.text}
          </div>
        )}
        <textarea
          aria-label="Your answer"
          className={`${fieldClass} resize-none`}
          rows={3}
          value={answer}
          disabled={running}
          placeholder={
            doc.pendingQuestion
              ? 'Answer, defend your decision, or ask for clarification (Ctrl/Cmd+Enter to send)'
              : 'Explain your thinking to the interviewer (Ctrl/Cmd+Enter to send)'
          }
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted">
            {PROVIDER_INFO[provider].displayName} · {model}
          </span>
          <Button type="submit" variant="primary" disabled={running || !answer.trim()}>
            Send answer
          </Button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message: m, outdated }: { message: Message; outdated: boolean }) {
  const mine = m.role === 'candidate';
  return (
    <li
      className={`rounded border p-2 ${mine ? 'ml-6 border-line bg-surface-2' : 'mr-6 border-line bg-surface'}`}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted">
        <span className="font-semibold">
          {mine ? 'You' : m.role === 'system' ? 'System' : 'Interviewer'}
        </span>
        {m.mode && !mine && <Badge>{MODE_LABELS[m.mode]}</Badge>}
        {outdated && (
          <Badge tone="warn" title="You changed the design after this was written">
            based on an earlier version
          </Badge>
        )}
      </div>
      <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.content}</p>
    </li>
  );
}
