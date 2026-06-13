import { type ReactNode } from "react";
import {
  ProjectWorkspacePageStoreContext,
  createProjectWorkspacePageStore,
} from "./projectWorkspacePageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const ProjectWorkspacePageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createProjectWorkspacePageStore());

  return (
    <ProjectWorkspacePageStoreContext.Provider value={store}>
      {children}
    </ProjectWorkspacePageStoreContext.Provider>
  );
};
