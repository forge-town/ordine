import { type ReactNode, useState } from "react";
import { JobsPageStoreContext, createJobsPageStore } from "./jobsPageStore";

interface Props {
  children: ReactNode;
}

export const JobsPageStoreProvider = ({ children }: Props) => {
  const [store] = useState(() => createJobsPageStore());

  return <JobsPageStoreContext.Provider value={store}>{children}</JobsPageStoreContext.Provider>;
};
