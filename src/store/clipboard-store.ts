import { create } from 'zustand';
import type { ClipboardData } from '@/features/interview-session/commands';

interface ClipboardState {
  data: ClipboardData | null;
  // How many times the current contents were pasted; successive pastes cascade diagonally.
  pasteCount: number;
  set(data: ClipboardData, options?: { cut?: boolean }): void;
  bump(): void;
}

// Kept inside the app: copying a design never touches the system clipboard.
export const useClipboardStore = create<ClipboardState>((set) => ({
  data: null,
  pasteCount: 0,
  // After a cut, the first paste lands where the items were, so cut and paste moves them.
  set: (data, options) => set({ data, pasteCount: options?.cut ? -1 : 0 }),
  bump: () => set((s) => ({ pasteCount: s.pasteCount + 1 })),
}));
