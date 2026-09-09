import { useState, type ReactNode } from "react";
import { ExecutionWorkspaceContext } from "./context";
import { createExecutionWorkspaceStore } from "./store";
export const ExecutionWorkspaceProvider = ({
  children,
  initialPipelineId,
  recoveryKey,
}: {
  children: ReactNode;
  initialPipelineId?: string;
  recoveryKey?: string;
}) => {
  const [store] = useState(() => createExecutionWorkspaceStore(initialPipelineId, recoveryKey));

  return (
    <ExecutionWorkspaceContext.Provider value={store}>
      {children}
    </ExecutionWorkspaceContext.Provider>
  );
};
