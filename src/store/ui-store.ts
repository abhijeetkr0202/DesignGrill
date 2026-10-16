import { create } from 'zustand';

export type View = 'library' | 'workspace' | 'settings';
export type LeftTab = 'problem' | 'requirements';
export type RightTab = 'interview' | 'findings' | 'decisions' | 'summary';
export type Theme = 'light' | 'dark';

interface UiState {
  view: View;
  theme: Theme;
  leftTab: LeftTab;
  rightTab: RightTab;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  leftWidth: number;
  rightWidth: number;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  focusNodeIds: string[];
  setView(view: View): void;
  setTheme(theme: Theme): void;
  setLeftTab(tab: LeftTab): void;
  setRightTab(tab: RightTab): void;
  toggleLeft(): void;
  toggleRight(): void;
  setLeftWidth(width: number): void;
  setRightWidth(width: number): void;
  setSelection(nodeIds: string[], edgeIds: string[]): void;
  clearSelection(): void;
  setFocusNodes(ids: string[]): void;
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

export const useUiStore = create<UiState>((set, get) => ({
  view: 'library',
  theme: 'dark',
  leftTab: 'problem',
  rightTab: 'interview',
  leftCollapsed: false,
  rightCollapsed: false,
  leftWidth: 340,
  rightWidth: 400,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  focusNodeIds: [],
  setView: (view) => set({ view }),
  setTheme: (theme) => set({ theme }),
  setLeftTab: (leftTab) => set({ leftTab, leftCollapsed: false }),
  setRightTab: (rightTab) => set({ rightTab, rightCollapsed: false }),
  toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRight: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
  setLeftWidth: (leftWidth) => set({ leftWidth }),
  setRightWidth: (rightWidth) => set({ rightWidth }),
  setSelection: (nodeIds, edgeIds) => {
    const s = get();
    if (sameSet(s.selectedNodeIds, nodeIds) && sameSet(s.selectedEdgeIds, edgeIds)) return;
    set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds });
  },
  clearSelection: () => set({ selectedNodeIds: [], selectedEdgeIds: [] }),
  setFocusNodes: (focusNodeIds) => set({ focusNodeIds }),
}));
