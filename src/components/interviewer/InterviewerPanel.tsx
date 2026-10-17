import { useEffect, useMemo, useRef, useState } from 'react';
import { PROVIDER_INFO } from '@/ai/provider-registry';
import { useUiStore } from '@/store/ui-store';
import { getInterviewService, useAiStore } from '@/features/interview-session/ai-store';
import { useChangeSummary } from '@/features/design-review/use-change-summary';
import { buildIdNames, humanizeIds } from '@/features/design-review/humanize-ids';
import { useSettingsStore } from '@/features/settings/settings-store';
import { useSessionStore } from '@/store/session-store';
import { clearChat, setGrowthStage } from '@/features/interview-session/commands';
import type { InterviewMode } from '@/types/session';
import { Button, ConfirmDialog, Notice, fieldClass } from '@/components/shared/ui';
import { AiContextPreview } from './AiContextPreview';
import { StageBar } from './StageBar';
import { ChatMessage, GreetingBubble, TypingIndicator } from './ChatMessages';
import { HistorySummaryControl } from './HistorySummaryControl';
import { ContextSizeNotice } from './ContextSizeNotice';

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

export function InterviewerPanel() {
  const doc = useSessionStore((s) => s.doc);
  const pack = useSessionStore((s) => s.pack);
  const progressive = useSettingsStore((s) => s.progressive);
  const ai = useAiStore((s) => s.state);
  const provider = useSettingsStore((s) => s.provider);
  const model = useSettingsStore((s) => s.models[s.provider]);
  const status = useSettingsStore((s) => s.providers[s.provider].status);
  const changes = useChangeSummary();
  const [answer, setAnswer] = useState('');
  const [confirmingClear, setConfirmingClear] = useState(false);
  const listEnd = useRef<HTMLDivElement>(null);
  const service = getInterviewService();
  const messageCount = doc?.messages.length ?? 0;
  const idNames = useMemo(() => (doc ? buildIdNames(doc) : null), [doc]);

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

  const goToStage = (index: number, announce: boolean) => {
    useSessionStore.getState().apply((d) => setGrowthStage(d, index), { history: false });
    // Moving up a stage makes the interviewer introduce it right away, like a real interview.
    if (announce) void service.request('architecture-interview');
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
        {progressive && (
          <StageBar
            index={doc.growthStage.index}
            busy={running}
            onNext={() => goToStage(doc.growthStage.index + 1, true)}
            onBack={() => goToStage(doc.growthStage.index - 1, false)}
          />
        )}
        <ContextSizeNotice doc={doc} pack={pack} />
        <HistorySummaryControl />
        <details className="text-[11px] text-muted">
          <summary className="cursor-pointer">What is sent to {info.displayName}?</summary>
          <p className="mt-1">
            Each AI action sends your problem statement, requirements, architecture (components,
            connections, properties), diagram drawings (text, shapes, arrows and which components
            they relate to), design decisions, open findings, recent chat messages (or, if you turn
            on summarised history, a short summary of older chat plus the newest messages), and
            illustrative reference notes for this problem, directly to {info.displayName} using
            model <code>{model}</code>. Nothing is sent until you click an action or send an answer.
            Your API key never leaves the OS credential store and native layer.
          </p>
        </details>
        <AiContextPreview doc={doc} pack={pack} isCustomEndpoint={provider === 'custom'} />
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
        {doc.messages.length === 0 && <GreetingBubble />}
        <ul className="space-y-3">
          {doc.messages.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              outdated={outdated && m.id === lastInterviewer?.id}
              humanize={(text) => (idNames ? humanizeIds(text, idNames) : text)}
            />
          ))}
        </ul>
        {running && <TypingIndicator onCancel={() => service.cancel()} />}
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
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              disabled={running || (doc.messages.length === 0 && !doc.pendingQuestion)}
              title="Remove the conversation and start over. Your design is kept."
              onClick={() => setConfirmingClear(true)}
            >
              Clear chat
            </Button>
            <Button type="submit" variant="primary" disabled={running || !answer.trim()}>
              Send answer
            </Button>
          </div>
        </div>
      </form>

      {confirmingClear && (
        <ConfirmDialog
          title="Clear the chat?"
          confirmLabel="Clear chat"
          message="This removes the conversation with the interviewer from this session, including any chat summary, so you can start the conversation again. Your requirements, diagram, decisions, findings and reviews are kept."
          onCancel={() => setConfirmingClear(false)}
          onConfirm={() => {
            setConfirmingClear(false);
            setAnswer('');
            useSessionStore.getState().apply((d) => clearChat(d), { history: false });
            useAiStore.getState().set({ status: 'idle' });
          }}
        />
      )}
    </div>
  );
}
