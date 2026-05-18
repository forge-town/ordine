import { type ReactNode } from "react";
import { AgentDetailPageStoreContext, createAgentDetailPageStore } from "./agentDetailPageStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
}

export const AgentDetailPageStoreProvider = ({ children }: Props) => {
  const store = useInit(() => createAgentDetailPageStore());

  return (
    <AgentDetailPageStoreContext.Provider value={store}>
      {children}
    </AgentDetailPageStoreContext.Provider>
  );
};
