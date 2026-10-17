import {
  editHistorySummaryText,
  resetHistorySummary,
  setHistorySummaryEnabled,
} from '@/features/interview-session/commands';
import { getInterviewService } from '@/features/interview-session/ai-store';
import { useSessionStore } from '@/store/session-store';
import type { SessionDocument } from '@/types/session';
import { Button, fieldClass } from '@/components/shared/ui';

const apply = (mutator: (doc: SessionDocument) => SessionDocument) =>
  useSessionStore.getState().apply(mutator, { history: false });

export function setSummarisedHistory(on: boolean): void {
  apply((d) => setHistorySummaryEnabled(d, on));
  if (on) void getInterviewService().refreshSummary();
}

export function HistorySummaryControl() {
  const summary = useSessionStore((s) => s.doc?.historySummary);
  if (!summary) return null;

  return (
    <div className="space-y-1 text-[11px] text-muted">
      <label
        className="flex cursor-pointer items-center gap-1.5"
        title="Older chat is condensed into a short summary, stored on this device, and sent instead of those messages. It costs one extra AI call about every 10 messages."
      >
        <input
          type="checkbox"
          checked={summary.enabled}
          onChange={(e) => setSummarisedHistory(e.target.checked)}
        />
        Use summarised history
      </label>
      {summary.enabled && (
        <details>
          <summary className="cursor-pointer">
            {summary.text
              ? `Chat summary${summary.updatedAt ? ` (updated ${new Date(summary.updatedAt).toLocaleTimeString()})` : ''}`
              : 'Chat summary (none yet, created after about 14 messages)'}
          </summary>
          <div className="mt-1 space-y-1">
            <textarea
              key={summary.text}
              aria-label="Chat summary"
              className={`${fieldClass} resize-y font-mono text-[11px]`}
              rows={6}
              maxLength={6000}
              defaultValue={summary.text}
              placeholder="The summary appears here once enough messages have piled up. You can correct it by hand."
              onBlur={(e) => {
                const text = e.currentTarget.value;
                apply((d) => editHistorySummaryText(d, text));
              }}
            />
            <Button
              size="sm"
              disabled={!summary.text}
              onClick={() => apply((d) => resetHistorySummary(d))}
            >
              Reset summary
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}
