import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createProjectsPageSlice, type ProjectsPageSlice } from "./projectsPageSlice";

export interface ProjectsPageState extends ProjectsPageSlice {}

export type ProjectsPageStoreSlice<T = ProjectsPageState> = StateCreator<
  ProjectsPageState,
  [],
  [],
  T
>;

export type ProjectsPageStore = StoreApi<ProjectsPageState>;

export const createProjectsPageStore = () => {
  return createStore<ProjectsPageState>()((set, get, api) => ({
    ...createProjectsPageSlice(set, get, api),
  }));
};

export const ProjectsPageStoreContext = createContext<ProjectsPageStore | null>(null);

export const useProjectsPageStore = () => {
  const context = useContext(ProjectsPageStoreContext);
  if (!context) {
    throw new Error("useProjectsPageStore must be used within a ProjectsPageStoreProvider");
  }

  return context;
};
