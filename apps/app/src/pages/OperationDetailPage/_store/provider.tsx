import {
  OperationDetailPageStoreContext,
  createOperationDetailPageStore,
} from "./operationDetailPageStore";
import { useInit } from "@/hooks/useInit";

export const OperationDetailPageStoreProvider = ({ children }: React.PropsWithChildren) => {
  const store = useInit(() => createOperationDetailPageStore());

  return (
    <OperationDetailPageStoreContext.Provider value={store}>
      {children}
    </OperationDetailPageStoreContext.Provider>
  );
};
