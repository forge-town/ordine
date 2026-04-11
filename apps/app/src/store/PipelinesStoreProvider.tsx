import { type ReactNode } from "react";
import {
  PipelinesStoreContext,
  createPipelinesStore,
  type Pipeline,
} from "./pipelinesStore";
import { useInit } from "@/hooks/useInit";

interface Props {
  children: ReactNode;
  initialPipelines?: Pipeline[];
}

export const PipelinesStoreProvider = ({
  children,
  initialPipelines = [],
}: Props) => {
  const store = useInit(() => createPipelinesStore(initialPipelines));

  return (
    <PipelinesStoreContext.Provider value={store}>
      {children}
    </PipelinesStoreContext.Provider>
  );
};
