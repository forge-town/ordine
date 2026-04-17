import { type ReactNode } from "react";
import { OperationsPageStoreContext, createOperationsPageStore } from "./operationsPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const OperationsPageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createOperationsPageStore());

  return (
    <OperationsPageStoreContext.Provider value={store}>
      {children}
    </OperationsPageStoreContext.Provider>
  );
};
