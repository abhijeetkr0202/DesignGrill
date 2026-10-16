import { useEffect, useState } from 'react';
import { computeChanges, type ChangeSummary } from '@/features/design-review/changes';
import { useSessionStore } from '@/store/session-store';

const DEBOUNCE_MS = 1500;

// Debounced so a burst of edits yields one summary; it only informs the UI and never calls the AI.
export function useChangeSummary(): ChangeSummary | null {
  const doc = useSessionStore((s) => s.doc);
  const [summary, setSummary] = useState<ChangeSummary | null>(null);
  const revision = doc?.revision;
  const baselineTakenAt = doc?.reviewBaseline?.takenAt;

  useEffect(() => {
    if (!doc) {
      setSummary(null);
      return;
    }
    const timer = setTimeout(() => setSummary(computeChanges(doc)), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // The document is read at fire time; re-running on every message append would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, baselineTakenAt, doc?.id]);

  return summary;
}
