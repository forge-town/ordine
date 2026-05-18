import { type ReactNode } from "react";
import { AgentsPageStoreContext, createAgentsPageStore } from "./agentsPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const AgentsPageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createAgentsPageStore());

  return (
    <AgentsPageStoreContext.Provider value={store}>{children}</AgentsPageStoreContext.Provider>
  );
};
