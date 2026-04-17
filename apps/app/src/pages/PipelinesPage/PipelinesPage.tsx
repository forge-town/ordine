import { PipelinesPageStoreProvider } from "./_store";
import { PipelinesPageContent } from "./PipelinesPageContent";

export const PipelinesPage = () => {
  return (
    <PipelinesPageStoreProvider>
      <PipelinesPageContent />
    </PipelinesPageStoreProvider>
  );
};
