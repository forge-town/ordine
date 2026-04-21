import { type ReactNode } from "react";
import {
  OperationCreatePageStoreContext,
  createOperationCreatePageStore,
} from "./operationCreatePageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const OperationCreatePageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createOperationCreatePageStore());

  return (
    <OperationCreatePageStoreContext.Provider value={store}>
      {children}
    </OperationCreatePageStoreContext.Provider>
  );
};
