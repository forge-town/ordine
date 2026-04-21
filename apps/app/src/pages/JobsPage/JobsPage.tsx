import { JobsPageStoreProvider } from "./_store";
import { JobsPageContent } from "./JobsPageContent";

export const JobsPage = () => {
  return (
    <JobsPageStoreProvider>
      <JobsPageContent />
    </JobsPageStoreProvider>
  );
};
