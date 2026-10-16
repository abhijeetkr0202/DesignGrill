import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArchitectureCanvas } from '@/components/canvas/ArchitectureCanvas';
import { Inspector } from '@/components/canvas/Inspector';
import { DecisionsPanel } from '@/components/interviewer/DecisionsPanel';
import { FindingsPanel } from '@/components/interviewer/FindingsPanel';
import { InterviewerPanel } from '@/components/interviewer/InterviewerPanel';
import { SummaryPanel } from '@/components/interviewer/SummaryPanel';
import { ProblemPanel } from '@/components/requirements/ProblemPanel';
import { RequirementsPanel } from '@/components/requirements/RequirementsPanel';
import { Splitter } from '@/components/shared/Splitter';
import { Notice } from '@/components/shared/ui';
import { getRepositories } from '@/data/repositories';
import { useSessionStore } from '@/store/session-store';
import { useUiStore, type LeftTab, type RightTab } from '@/store/ui-store';
import { Toolbar } from './Toolbar';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  );
}

function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (t: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex border-b border-line bg-surface">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`px-3 py-2 text-xs font-medium ${value === t.id ? 'border-b-2 border-accent text-fg' : 'text-muted hover:text-fg'}`}
        >
          {t.label}
          {t.count ? ` (${t.count})` : ''}
        </button>
      ))}
    </div>
  );
}

export function Workspace() {
  const ui = useUiStore(
    useShallow((s) => ({
      leftTab: s.leftTab,
      rightTab: s.rightTab,
      leftCollapsed: s.leftCollapsed,
      rightCollapsed: s.rightCollapsed,
      leftWidth: s.leftWidth,
      rightWidth: s.rightWidth,
      toggleLeft: s.toggleLeft,
      toggleRight: s.toggleRight,
      setLeftTab: s.setLeftTab,
      setRightTab: s.setRightTab,
      setLeftWidth: s.setLeftWidth,
      setRightWidth: s.setRightWidth,
    })),
  );
  const findingCount = useSessionStore(
    (s) => s.doc?.findings.filter((f) => f.status === 'open' && f.kind !== 'strength').length ?? 0,
  );
  const decisionCount = useSessionStore((s) => s.doc?.decisions.length ?? 0);
  const hasSelection = useUiStore((s) => s.selectedNodeIds.length + s.selectedEdgeIds.length > 0);

  useEffect(() => {
    // Small windows start with the interviewer panel collapsed so the canvas stays usable.
    if (window.innerWidth < 1100) useUiStore.setState({ rightCollapsed: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || isTyping(e.target)) return;
      e.preventDefault();
      const s = useSessionStore.getState();
      if (e.shiftKey) s.redo();
      else s.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') void useSessionStore.getState().save();
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, []);

  const left: { id: LeftTab; label: string }[] = [
    { id: 'problem', label: 'Problem' },
    { id: 'requirements', label: 'Requirements' },
  ];
  const right: { id: RightTab; label: string; count?: number }[] = [
    { id: 'interview', label: 'Interview' },
    { id: 'findings', label: 'Findings', count: findingCount },
    { id: 'decisions', label: 'Decisions', count: decisionCount },
    { id: 'summary', label: 'Summary' },
  ];

  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      {!getRepositories().durable && (
        <Notice tone="warn">
          Browser preview: sessions are kept in memory only and AI is unavailable. Run the desktop
          app (npm run dev:desktop) to save sessions and use AI.
        </Notice>
      )}
      <SaveErrorBanner />
      <div className="flex min-h-0 flex-1">
        {ui.leftCollapsed ? (
          <CollapsedRail side="left" label="Show requirements" onClick={ui.toggleLeft} />
        ) : (
          <>
            <aside
              className="flex min-h-0 shrink-0 flex-col bg-bg"
              style={{ width: ui.leftWidth }}
              aria-label="Problem and requirements"
            >
              <Tabs tabs={left} value={ui.leftTab} onChange={ui.setLeftTab} label="Left panel" />
              <div className="min-h-0 flex-1 overflow-y-auto">
                {ui.leftTab === 'problem' ? <ProblemPanel /> : <RequirementsPanel />}
              </div>
              <PanelFooter onCollapse={ui.toggleLeft} label="Collapse panel" />
            </aside>
            <Splitter
              side="left"
              width={ui.leftWidth}
              min={240}
              max={560}
              onChange={ui.setLeftWidth}
              label="Resize requirements panel"
            />
          </>
        )}

        <main className="flex min-h-0 min-w-[320px] flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <ArchitectureCanvas />
          </div>
          {hasSelection && (
            <div
              className="max-h-[42%] shrink-0 overflow-y-auto border-t border-line bg-bg"
              aria-label="Properties"
            >
              <Inspector />
            </div>
          )}
        </main>

        {ui.rightCollapsed ? (
          <CollapsedRail side="right" label="Show interviewer" onClick={ui.toggleRight} />
        ) : (
          <>
            <Splitter
              side="right"
              width={ui.rightWidth}
              min={300}
              max={640}
              onChange={ui.setRightWidth}
              label="Resize interviewer panel"
            />
            <aside
              className="flex min-h-0 shrink-0 flex-col bg-bg"
              style={{ width: ui.rightWidth }}
              aria-label="Interviewer"
            >
              <Tabs
                tabs={right}
                value={ui.rightTab}
                onChange={ui.setRightTab}
                label="Interviewer panel"
              />
              <div className="min-h-0 flex-1 overflow-y-auto">
                {ui.rightTab === 'interview' && <InterviewerPanel />}
                {ui.rightTab === 'findings' && <FindingsPanel />}
                {ui.rightTab === 'decisions' && <DecisionsPanel />}
                {ui.rightTab === 'summary' && <SummaryPanel />}
              </div>
              <PanelFooter onCollapse={ui.toggleRight} label="Collapse panel" />
            </aside>
          </>
        )}
      </div>
    </div>
  );
}

function SaveErrorBanner() {
  const status = useSessionStore((s) => s.saveStatus);
  const error = useSessionStore((s) => s.saveError);
  if (status !== 'error') return null;
  return (
    <Notice tone="danger">
      Your latest changes could not be saved: {error}. They are still in memory; use Retry save in
      the toolbar.
    </Notice>
  );
}

function CollapsedRail({
  side,
  label,
  onClick,
}: {
  side: 'left' | 'right';
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-7 shrink-0 bg-surface text-muted hover:text-fg ${side === 'left' ? 'border-r' : 'border-l'} border-line`}
    >
      {side === 'left' ? '»' : '«'}
    </button>
  );
}

function PanelFooter({ onCollapse, label }: { onCollapse: () => void; label: string }) {
  return (
    <div className="border-t border-line bg-surface px-2 py-1 text-right">
      <button type="button" className="text-[11px] text-muted hover:text-fg" onClick={onCollapse}>
        {label}
      </button>
    </div>
  );
}
