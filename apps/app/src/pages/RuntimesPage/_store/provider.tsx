import { type ReactNode, useRef } from "react";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { RuntimesStoreContext, createRuntimesStore, type RuntimesStore } from "./runtimesStore";

interface Props {
  children: ReactNode;
  initialRuntimes?: AgentRuntimeConfig[];
}

export const RuntimesStoreProvider = ({ children, initialRuntimes }: Props) => {
  const storeRef = useRef<RuntimesStore | null>(null);
  const initialJsonRef = useRef<string | undefined>(undefined);
  const json = initialRuntimes ? JSON.stringify(initialRuntimes) : undefined;

  if (!storeRef.current || initialJsonRef.current !== json) {
    initialJsonRef.current = json;
    storeRef.current = createRuntimesStore(initialRuntimes);
  }

  return (
    <RuntimesStoreContext.Provider value={storeRef.current}>
      {children}
    </RuntimesStoreContext.Provider>
  );
};
