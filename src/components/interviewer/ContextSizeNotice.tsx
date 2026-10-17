import { useDeferredValue, useMemo } from 'react';
import { useSettingsStore } from '@/features/settings/settings-store';
import {
  SNAPSHOT_LIMIT_CHARS,
  SNAPSHOT_WARN_CHARS,
  buildSnapshotDetailed,
} from '@/features/design-review/snapshot';
import type { ProblemPack } from '@/features/problem-library/schema';
import type { SessionDocument } from '@/types/session';
import { Button, Notice } from '@/components/shared/ui';
import { setSummarisedHistory } from './HistorySummaryControl';

// Measured for the largest request (a review) so the warning appears before any action hits the limit.
export function ContextSizeNotice({
  doc,
  pack,
}: {
  doc: SessionDocument;
  pack: ProblemPack | null;
}) {
  const deferredDoc = useDeferredValue(doc);
  const progressive = useSettingsStore((s) => s.progressive);
  const size = useMemo(
    () =>
      pack
        ? buildSnapshotDetailed(deferredDoc, pack, 'architecture-review', '', { progressive })
        : null,
    [deferredDoc, pack, progressive],
  );
  if (!size) return null;

  const trimmed = size.trimmed.length > 0;
  if (!trimmed && size.fullChars < SNAPSHOT_WARN_CHARS) return null;

  const enabled = doc.historySummary.enabled;
  const percent = Math.round((size.fullChars / SNAPSHOT_LIMIT_CHARS) * 100);
  return (
    <Notice
      tone={trimmed ? 'warn' : 'neutral'}
      action={
        enabled ? undefined : (
          <Button size="sm" onClick={() => setSummarisedHistory(true)}>
            Turn on summarised history
          </Button>
        )
      }
    >
      {trimmed
        ? `Your session no longer fits in one request, so some of it is being shortened: ${size.trimmed.join('; ')}.`
        : `This session is using ${percent}% of the request size limit.`}{' '}
      {enabled
        ? 'Summarised history is on and catches up after your next reply. Messages not yet summarised may be left out until then; shortening very long requirement or decision text also helps.'
        : 'Summarised history keeps full detail of older chat in a short form.'}
    </Notice>
  );
}
