import { create } from "zustand";

export type InboxTab = "all" | "unread" | "starred" | "archived";

interface InboxUiState {
  tab: InboxTab;
  selectedId: string | null;
  setTab: (tab: InboxTab) => void;
  select: (id: string | null) => void;
}

/** Client-only UI state (Zustand): which inbox filter and conversation are open. */
export const useInboxUiStore = create<InboxUiState>((set) => ({
  tab: "all",
  selectedId: null,
  setTab: (tab) => set({ tab }),
  select: (selectedId) => set({ selectedId }),
}));
