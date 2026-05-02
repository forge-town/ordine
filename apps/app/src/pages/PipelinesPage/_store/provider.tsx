import { type ReactNode, useState } from "react";
import { PipelinesPageStoreContext, createPipelinesPageStore } from "./pipelinesPageStore";

interface Props {
  children: ReactNode;
}

export const PipelinesPageStoreProvider = ({ children }: Props) => {
  const [store] = useState(() => createPipelinesPageStore());

  return (
    <PipelinesPageStoreContext.Provider value={store}>
      {children}
    </PipelinesPageStoreContext.Provider>
  );
};
