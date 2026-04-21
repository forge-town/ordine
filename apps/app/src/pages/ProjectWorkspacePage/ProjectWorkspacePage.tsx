import { ProjectWorkspacePageStoreProvider } from "./_store";
import { ProjectWorkspacePageContent } from "./ProjectWorkspacePageContent";

export const ProjectWorkspacePage = () => (
  <ProjectWorkspacePageStoreProvider>
    <ProjectWorkspacePageContent />
  </ProjectWorkspacePageStoreProvider>
);
