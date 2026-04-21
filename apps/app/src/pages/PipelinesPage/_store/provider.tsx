import { type ReactNode } from "react";
import { PipelinesPageStoreContext, createPipelinesPageStore } from "./pipelinesPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const PipelinesPageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createPipelinesPageStore());

  return (
    <PipelinesPageStoreContext.Provider value={store}>
      {children}
    </PipelinesPageStoreContext.Provider>
  );
};
