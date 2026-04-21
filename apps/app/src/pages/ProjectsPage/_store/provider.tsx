import { type ReactNode } from "react";
import { ProjectsPageStoreContext, createProjectsPageStore } from "./projectsPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const ProjectsPageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createProjectsPageStore());

  return (
    <ProjectsPageStoreContext.Provider value={store}>{children}</ProjectsPageStoreContext.Provider>
  );
};
