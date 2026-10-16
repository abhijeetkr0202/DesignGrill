import { create } from 'zustand';
import { getRepositories } from '@/data/repositories';
import type { ProblemPack } from '@/features/problem-library/schema';
import type { Architecture, Decision, Requirement, SessionDocument } from '@/types/session';
import { defaultContext } from '@/utils/context';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface HistorySlice {
  requirements: Requirement[];
  architecture: Architecture;
  decisions: Decision[];
}

const HISTORY_LIMIT = 100;
const AUTOSAVE_DELAY_MS = 700;

export interface SessionState {
  doc: SessionDocument | null;
  pack: ProblemPack | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: string | null;
  undoStack: HistorySlice[];
  redoStack: HistorySlice[];

  open(doc: SessionDocument, pack: ProblemPack): void;
  close(): Promise<void>;
  // All edits go through here so history, dirty tracking and autosave stay consistent.
  apply(mutator: (doc: SessionDocument) => SessionDocument, options?: { history?: boolean }): void;
  undo(): void;
  redo(): void;
  save(): Promise<void>;
}

const slice = (d: SessionDocument): HistorySlice => ({
  requirements: d.requirements,
  architecture: d.architecture,
  decisions: d.decisions,
});

const sliceChanged = (a: SessionDocument, b: SessionDocument) =>
  a.requirements !== b.requirements ||
  a.architecture !== b.architecture ||
  a.decisions !== b.decisions;

let version = 0;
let savedVersion = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

export const useSessionStore = create<SessionState>((set, get) => {
  const scheduleSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void get().save(), AUTOSAVE_DELAY_MS);
  };

  const restore = (from: HistorySlice, base: SessionDocument): SessionDocument => ({
    ...base,
    ...from,
    revision: base.revision + 1,
    updatedAt: defaultContext.now(),
  });

  return {
    doc: null,
    pack: null,
    saveStatus: 'idle',
    saveError: null,
    lastSavedAt: null,
    undoStack: [],
    redoStack: [],

    open(doc, pack) {
      if (timer) clearTimeout(timer);
      version = 0;
      savedVersion = 0;
      set({
        doc,
        pack,
        saveStatus: 'saved',
        saveError: null,
        lastSavedAt: doc.updatedAt,
        undoStack: [],
        redoStack: [],
      });
    },

    async close() {
      if (timer) clearTimeout(timer);
      if (get().doc && version !== savedVersion) await get().save();
      set({ doc: null, pack: null, saveStatus: 'idle', undoStack: [], redoStack: [] });
    },

    apply(mutator, options = {}) {
      const before = get().doc;
      if (!before) return;
      const after = mutator(before);
      if (after === before) return;
      version++;
      const record = (options.history ?? true) && sliceChanged(before, after);
      set((s) => ({
        doc: after,
        saveStatus: 'dirty',
        undoStack: record ? [...s.undoStack, slice(before)].slice(-HISTORY_LIMIT) : s.undoStack,
        redoStack: record ? [] : s.redoStack,
      }));
      scheduleSave();
    },

    undo() {
      const { doc, undoStack } = get();
      const previous = undoStack[undoStack.length - 1];
      if (!doc || !previous) return;
      version++;
      set((s) => ({
        doc: restore(previous, doc),
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, slice(doc)],
        saveStatus: 'dirty',
      }));
      scheduleSave();
    },

    redo() {
      const { doc, redoStack } = get();
      const next = redoStack[redoStack.length - 1];
      if (!doc || !next) return;
      version++;
      set((s) => ({
        doc: restore(next, doc),
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, slice(doc)],
        saveStatus: 'dirty',
      }));
      scheduleSave();
    },

    async save() {
      const doc = get().doc;
      if (!doc) return;
      if (timer) clearTimeout(timer);
      const target = version;
      set({ saveStatus: 'saving' });
      try {
        await getRepositories().sessions.save(doc);
        savedVersion = target;
        const stillDirty = version !== target;
        set({
          saveStatus: stillDirty ? 'dirty' : 'saved',
          saveError: null,
          lastSavedAt: stillDirty ? get().lastSavedAt : doc.updatedAt,
        });
        if (stillDirty) scheduleSave();
      } catch (e) {
        // Edits stay in memory and are retried on the next change or manual save.
        set({
          saveStatus: 'error',
          saveError: e instanceof Error ? e.message : 'Saving failed',
        });
      }
    },
  };
});
