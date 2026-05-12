import { OperationDetailPageContent } from "./OperationDetailPageContent";
import { OperationDetailPageStoreProvider } from "./_store";

export const OperationDetailPage = () => {
  return (
    <OperationDetailPageStoreProvider>
      <OperationDetailPageContent />
    </OperationDetailPageStoreProvider>
  );
};
