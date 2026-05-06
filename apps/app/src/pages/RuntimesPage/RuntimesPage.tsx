import { RuntimesPageStoreProvider } from "./_store";
import { RuntimesPageContent } from "./RuntimesPageContent";

export const RuntimesPage = () => {
  return (
    <RuntimesPageStoreProvider>
      <RuntimesPageContent />
    </RuntimesPageStoreProvider>
  );
};

