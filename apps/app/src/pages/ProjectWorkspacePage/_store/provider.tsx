import { type ReactNode, useState } from "react";
import {
  ProjectWorkspacePageStoreContext,
  createProjectWorkspacePageStore,
} from "./projectWorkspacePageStore";

interface Props {
  children: ReactNode;
}

export const ProjectWorkspacePageStoreProvider = ({ children }: Props) => {
  const [store] = useState(() => createProjectWorkspacePageStore());

  return (
    <ProjectWorkspacePageStoreContext.Provider value={store}>
      {children}
    </ProjectWorkspacePageStoreContext.Provider>
  );
};
