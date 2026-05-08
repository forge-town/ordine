import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createSidebarSlice, type SidebarSlice } from "./sidebarSlice";
import {
  createNewPipelineDialogSlice,
  type NewPipelineDialogSlice,
} from "./newPipelineDialogSlice";

export interface SidebarState extends SidebarSlice, NewPipelineDialogSlice {}

export type SidebarStoreSlice<T = SidebarState> = StateCreator<SidebarState, [], [], T>;

export type SidebarStore = StoreApi<SidebarState>;

export const createSidebarStore = () => {
  return createStore<SidebarState>()((set, get, api) => ({
    ...createSidebarSlice(set, get, api),
    ...createNewPipelineDialogSlice(set, get, api),
  }));
};

export const sidebarStore = createSidebarStore();

export const SidebarStoreContext = createContext<SidebarStore | null>(null);

export const useSidebarStore = () => {
  const context = useContext(SidebarStoreContext);
  if (!context) {
    throw new Error("useSidebarStore must be used within a SidebarStoreProvider");
  }

  return context;
};
