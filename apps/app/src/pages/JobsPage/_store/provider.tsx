import { type ReactNode } from "react";
import { JobsPageStoreContext, createJobsPageStore } from "./jobsPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const JobsPageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createJobsPageStore());

  return <JobsPageStoreContext.Provider value={store}>{children}</JobsPageStoreContext.Provider>;
};
