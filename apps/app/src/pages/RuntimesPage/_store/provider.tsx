import { type ReactNode } from "react";
import { RuntimesPageStoreContext, createRuntimesPageStore } from "./runtimesPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const RuntimesPageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createRuntimesPageStore());

  return <RuntimesPageStoreContext.Provider value={store}>{children}</RuntimesPageStoreContext.Provider>;
};
