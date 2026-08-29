import { createStore, type StateCreator } from "zustand";
import { createContext, useContext } from "react";

interface ToastMessage {
  id: string;
  type: "success" | "error";
  title: string;
  description?: string;
  duration?: number;
}

interface ToastSlice {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, "id"> & { id?: string }) => void;
  removeToast: (id: string) => void;
}

const createToastSlice = (set: Parameters<StateCreator<ToastSlice>>[0]): ToastSlice => ({
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

export const createToastStore = () => createStore<ToastSlice>()((set) => createToastSlice(set));

export const toastStore = createToastStore();

export const ToastStoreContext = createContext<ReturnType<typeof createToastStore> | null>(null);

export const useToastStore = (): ReturnType<typeof createToastStore> => {
  const context = useContext(ToastStoreContext);
  if (!context) {
    throw new Error("useToastStore must be used within ToastStoreProvider");
  }

  return context;
};
