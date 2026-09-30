import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface GigDraft {
  titleRest: string;
  category: string;
  subcategory: string;
  tags: string[];
  price: string;
  turnaroundHours: 24 | 48;
  revisionsIncluded: number;
  description: string;
  faqs: { question: string; answer: string }[];
  requirementsPrompt: string[];
}

export const EMPTY_DRAFT: GigDraft = {
  titleRest: "",
  category: "",
  subcategory: "",
  tags: [],
  price: "",
  turnaroundHours: 24,
  revisionsIncluded: 2,
  description: "",
  faqs: [],
  requirementsPrompt: [""],
};

interface GigDraftState {
  draft: GigDraft;
  savedAt: string | null;
  update: <K extends keyof GigDraft>(key: K, value: GigDraft[K]) => void;
  patch: (partial: Partial<GigDraft>) => void;
  markSaved: () => void;
  reset: () => void;
}

/**
 * Client-only state (Zustand + localStorage): the gig wizard draft autosaves as the seller
 * types (GIG-01 "client autosave"). Hydration is manual (`skipHydration`) so the server
 * render and first client render match; the wizard calls `rehydrate()` after mount.
 */
export const useGigDraftStore = create<GigDraftState>()(
  persist(
    (set) => ({
      draft: EMPTY_DRAFT,
      savedAt: null,
      update: (key, value) => set((s) => ({ draft: { ...s.draft, [key]: value } })),
      patch: (partial) => set((s) => ({ draft: { ...s.draft, ...partial } })),
      markSaved: () => set({ savedAt: new Date().toLocaleTimeString() }),
      reset: () => set({ draft: EMPTY_DRAFT, savedAt: null }),
    }),
    {
      name: "microgig:gig-draft",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ draft: s.draft }),
      skipHydration: true,
    },
  ),
);
