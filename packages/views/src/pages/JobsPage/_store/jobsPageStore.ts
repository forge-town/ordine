import { createContext, useContext } from "react";
import { createStore } from "zustand";
import { createJobsPageSlice, type JobsPageSlice } from "./jobsPageSlice";

export const createJobsPageStore = () => {
  return createStore<JobsPageSlice>()((set, get, api) => ({
    ...createJobsPageSlice(set, get, api),
  }));
};

export const JobsPageStoreContext = createContext<ReturnType<typeof createJobsPageStore> | null>(
  null,
);

export const useJobsPageStore = () => {
  const context = useContext(JobsPageStoreContext);
  if (!context) {
    throw new Error("useJobsPageStore must be used within a JobsPageStoreProvider");
  }

  return context;
};
