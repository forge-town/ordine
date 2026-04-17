import { createStore, type StoreApi, type StateCreator } from "zustand";
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

export type ToastStore = StoreApi<ToastSlice>;

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

export const createToastStore = (): ToastStore =>
  createStore<ToastSlice>()((set) => createToastSlice(set));

export const toastStore = createToastStore();

export const ToastStoreContext = createContext<ToastStore | null>(null);

export const useToastStore = (): ToastStore => {
  const context = useContext(ToastStoreContext);
  if (!context) {
    throw new Error("useToastStore must be used within ToastStoreProvider");
  }

  return context;
};
