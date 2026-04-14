import { create, type StoreApi, type StateCreator } from "zustand";
import { createContext, useContext } from "react";

export interface ToastMessage {
  id: string;
  type: "success" | "error";
  title: string;
  description?: string;
  duration?: number;
}

export interface ToastSlice {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, "id"> & { id?: string }) => void;
  removeToast: (id: string) => void;
}

export type ToastStoreSlice<T = ToastSlice> = StateCreator<ToastSlice, [], [], T>;

export const createToastSlice = (set: Parameters<ToastStoreSlice>[0]): ToastSlice => ({
  toasts: [],
  addToast: (toast) => {
    const id = toast.id ?? Math.random().toString(36).slice(2, 9);
    set((state) => ({
      toasts: [...state.toasts.filter((t) => t.id !== id), { ...toast, id }],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
});

export const createToastStore = () => create<ToastSlice>()((set) => createToastSlice(set));

/**
 * Global singleton store for toast notifications.
 *
 * Toast state is intentionally kept as an app-wide singleton because it is
 * consumed from both React components and non-React code paths (e.g. Refine
 * notification provider and canvas action slices). The slice and provider
 * patterns are still exposed below for consistency with the rest of the
 * codebase.
 */
export const toastStore = createToastStore();

/**
 * Backward-compatible hook alias.
 *
 * Zustand's `create` returns a function that works as a React hook and also
 * exposes the store API (`getState`, `setState`, `subscribe`). Existing code
 * relies on both behaviours, so we re-export the singleton instance under the
 * original name.
 */
export const useToastStore = toastStore;

export const ToastStoreContext = createContext<StoreApi<ToastSlice> | null>(null);

export const useToastStoreContext = (): StoreApi<ToastSlice> => {
  const context = useContext(ToastStoreContext);
  if (!context) {
    throw new Error("useToastStoreContext must be used within ToastStoreProvider");
  }
  return context;
};
