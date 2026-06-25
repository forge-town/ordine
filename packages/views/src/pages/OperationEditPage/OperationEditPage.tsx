import { OperationEditPageContent } from "./OperationEditPageContent";
import { OperationEditPageStoreProvider } from "./_store";

export const OperationEditPage = () => {
  return (
    <OperationEditPageStoreProvider>
      <OperationEditPageContent />
    </OperationEditPageStoreProvider>
  );
};
