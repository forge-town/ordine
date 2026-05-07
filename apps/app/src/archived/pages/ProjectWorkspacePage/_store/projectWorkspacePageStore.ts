import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import {
  createProjectWorkspacePageSlice,
  type ProjectWorkspacePageSlice,
} from "./projectWorkspacePageSlice";

export interface ProjectWorkspacePageState extends ProjectWorkspacePageSlice {}

export type ProjectWorkspacePageStoreSlice<T = ProjectWorkspacePageState> = StateCreator<
  ProjectWorkspacePageState,
  [],
  [],
  T
>;

export type ProjectWorkspacePageStore = StoreApi<ProjectWorkspacePageState>;

export const createProjectWorkspacePageStore = () => {
  return createStore<ProjectWorkspacePageState>()((set, get, api) => ({
    ...createProjectWorkspacePageSlice(set, get, api),
  }));
};

export const ProjectWorkspacePageStoreContext = createContext<ProjectWorkspacePageStore | null>(
  null
);

export const useProjectWorkspacePageStore = () => {
  const context = useContext(ProjectWorkspacePageStoreContext);
  if (!context) {
    throw new Error(
      "useProjectWorkspacePageStore must be used within a ProjectWorkspacePageStoreProvider"
    );
  }

  return context;
};
