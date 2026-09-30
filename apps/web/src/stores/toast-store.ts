import { create } from "zustand";

export type ToastVariant = "success" | "info" | "warning" | "danger";

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** Client-only UI state (Zustand): app-wide toast notifications, rendered by <Toaster />. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, variant = "success") => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, variant }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 6000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience for calling from event handlers and mutation callbacks. */
export const toast = (message: string, variant?: ToastVariant) => useToastStore.getState().show(message, variant);
