import { type ReactNode, useState } from "react";
import { ProjectsPageStoreContext, createProjectsPageStore } from "./projectsPageStore";

interface Props {
  children: ReactNode;
}

export const ProjectsPageStoreProvider = ({ children }: Props) => {
  const [store] = useState(() => createProjectsPageStore());

  return (
    <ProjectsPageStoreContext.Provider value={store}>{children}</ProjectsPageStoreContext.Provider>
  );
};
