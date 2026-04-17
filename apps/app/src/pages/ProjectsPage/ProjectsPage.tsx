import { ProjectsPageStoreProvider } from "./_store";
import { ProjectsPageContent } from "./ProjectsPageContent";

export const ProjectsPage = () => {
  return (
    <ProjectsPageStoreProvider>
      <ProjectsPageContent />
    </ProjectsPageStoreProvider>
  );
};
