import type { ReactNode } from "react";
import { ToastStoreContext, toastStore } from "./toastStore";

export const ToastStoreProvider = ({ children }: { children: ReactNode }) => {
  return <ToastStoreContext.Provider value={toastStore}>{children}</ToastStoreContext.Provider>;
};
