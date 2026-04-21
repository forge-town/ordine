import { type ReactNode } from "react";
import {
  OperationEditPageStoreContext,
  createOperationEditPageStore,
} from "./operationEditPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const OperationEditPageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createOperationEditPageStore());

  return (
    <OperationEditPageStoreContext.Provider value={store}>
      {children}
    </OperationEditPageStoreContext.Provider>
  );
};
