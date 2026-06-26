import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createJobsPageSlice, type JobsPageSlice } from "./jobsPageSlice";

export interface JobsPageState extends JobsPageSlice {}

export type JobsPageStoreSlice<T = JobsPageState> = StateCreator<JobsPageState, [], [], T>;

export type JobsPageStore = StoreApi<JobsPageState>;

export const createJobsPageStore = () => {
  return createStore<JobsPageState>()((set, get, api) => ({
    ...createJobsPageSlice(set, get, api),
  }));
};

export const JobsPageStoreContext = createContext<JobsPageStore | null>(null);

export const useJobsPageStore = () => {
  const context = useContext(JobsPageStoreContext);
  if (!context) {
    throw new Error("useJobsPageStore must be used within a JobsPageStoreProvider");
  }

  return context;
};
