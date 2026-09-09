import { createContext, useContext } from "react";
import type { createExecutionWorkspaceStore } from "./store";
export const ExecutionWorkspaceContext = createContext<ReturnType<
  typeof createExecutionWorkspaceStore
> | null>(null);
export const useExecutionStore = () => {
  const store = useContext(ExecutionWorkspaceContext);
  if (!store) throw new Error("ExecutionWorkspaceProvider is required");

  return store;
};
