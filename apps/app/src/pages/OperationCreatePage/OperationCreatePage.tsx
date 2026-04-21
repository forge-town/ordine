import { OperationCreatePageStoreProvider } from "./_store";
import { OperationCreatePageContent } from "./OperationCreatePageContent";

export const OperationCreatePage = () => {
  return (
    <OperationCreatePageStoreProvider>
      <OperationCreatePageContent />
    </OperationCreatePageStoreProvider>
  );
};
