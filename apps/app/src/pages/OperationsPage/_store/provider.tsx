import { type ReactNode, useState } from "react";
import { OperationsPageStoreContext, createOperationsPageStore } from "./operationsPageStore";

interface Props {
  children: ReactNode;
}

export const OperationsPageStoreProvider = ({ children }: Props) => {
  const [store] = useState(() => createOperationsPageStore());

  return (
    <OperationsPageStoreContext.Provider value={store}>
      {children}
    </OperationsPageStoreContext.Provider>
  );
};
