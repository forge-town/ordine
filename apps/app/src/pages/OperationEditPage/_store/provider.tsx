import { type ReactNode, useState } from "react";
import {
  OperationEditPageStoreContext,
  createOperationEditPageStore,
} from "./operationEditPageStore";

interface Props {
  children: ReactNode;
}

export const OperationEditPageStoreProvider = ({ children }: Props) => {
  const [store] = useState(() => createOperationEditPageStore());

  return (
    <OperationEditPageStoreContext.Provider value={store}>
      {children}
    </OperationEditPageStoreContext.Provider>
  );
};
