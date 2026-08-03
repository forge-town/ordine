import type { ReactNode } from "react";
import { useInit } from "../../hooks/useInit";
import { AutonomyStoreContext, createAutonomyStore } from "./autonomyStore";

export const AutonomyStoreProvider = ({ children }: { children: ReactNode }) => {
  const store = useInit(createAutonomyStore);

  return <AutonomyStoreContext.Provider value={store}>{children}</AutonomyStoreContext.Provider>;
};
