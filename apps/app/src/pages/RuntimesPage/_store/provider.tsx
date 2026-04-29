import { type ReactNode } from "react";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { RuntimesPageStoreContext, createRuntimesPageStore } from "./runtimesStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
  initialRuntimes?: AgentRuntimeConfig[];
}

export const RuntimesPageStoreProvider = ({ children, initialRuntimes }: Props) => {
  const store = useInit(() => createRuntimesPageStore(initialRuntimes));

  return (
    <RuntimesPageStoreContext.Provider value={store}>{children}</RuntimesPageStoreContext.Provider>
  );
};
