import { AgentDetailPageStoreProvider } from "./_store";
import { AgentDetailPageContent } from "./AgentDetailPageContent";

export const AgentDetailPage = () => {
  return (
    <AgentDetailPageStoreProvider>
      <AgentDetailPageContent />
    </AgentDetailPageStoreProvider>
  );
};
