import { type ReactNode, useState } from "react";
import {
  OperationCreatePageStoreContext,
  createOperationCreatePageStore,
} from "./operationCreatePageStore";

interface Props {
  children: ReactNode;
}

export const OperationCreatePageStoreProvider = ({ children }: Props) => {
  const [store] = useState(() => createOperationCreatePageStore());

  return (
    <OperationCreatePageStoreContext.Provider value={store}>
      {children}
    </OperationCreatePageStoreContext.Provider>
  );
};
