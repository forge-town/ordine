import { OperationsPageStoreProvider } from "./_store";
import { OperationsPageContent } from "./OperationsPageContent";

export const OperationsPage = () => {
  return (
    <OperationsPageStoreProvider>
      <OperationsPageContent />
    </OperationsPageStoreProvider>
  );
};
