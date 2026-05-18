import { AgentsPageStoreProvider } from "./_store";
import { AgentsPageContent } from "./AgentsPageContent";

export const AgentsPage = () => {
  return (
    <AgentsPageStoreProvider>
      <AgentsPageContent />
    </AgentsPageStoreProvider>
  );
};
