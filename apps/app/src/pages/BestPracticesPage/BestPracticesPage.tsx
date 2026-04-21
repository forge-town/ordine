import { BestPracticesPageStoreProvider } from "./_store";
import { BestPracticesPageContent } from "./BestPracticesPageContent";

export const BestPracticesPage = () => {
  return (
    <BestPracticesPageStoreProvider>
      <BestPracticesPageContent />
    </BestPracticesPageStoreProvider>
  );
};
