import type { ReactNode } from "react";
import { SidebarStoreContext, sidebarStore } from "./sidebarStore";

export const SidebarStoreProvider = ({ children }: { children: ReactNode }) => {
  return (
    <SidebarStoreContext.Provider value={sidebarStore}>{children}</SidebarStoreContext.Provider>
  );
};
