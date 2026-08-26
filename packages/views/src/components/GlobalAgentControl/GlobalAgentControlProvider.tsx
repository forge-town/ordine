import { createContext, useContext, useEffect, useRef, type PropsWithChildren } from "react";
import { useStore } from "zustand";
import { usePlatform } from "../../platform";
import { createAgentControlClient } from "./agentControlClient";
import {
  createAgentControlStore,
  type AgentControlState,
  type AgentControlStore,
} from "./agentControlStore";

const AgentControlStoreContext = createContext<AgentControlStore | null>(null);

export const GlobalAgentControlProvider = ({ children }: PropsWithChildren) => {
  const platform = usePlatform();
  const storeRef = useRef<AgentControlStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createAgentControlStore(createAgentControlClient(platform));
  }

  useEffect(() => {
    void storeRef.current?.getState().bootstrap();

    return () => {
      storeRef.current?.getState().registerCanvasSurface(null);
      storeRef.current?.getState().registerInvalidator(null);
      storeRef.current?.getState().registerNavigator(null);
    };
  }, []);

  return (
    <AgentControlStoreContext.Provider value={storeRef.current}>
      {children}
    </AgentControlStoreContext.Provider>
  );
};

export const useOptionalAgentControlStore = () => useContext(AgentControlStoreContext);

export const useAgentControlStore = (): AgentControlStore => {
  const store = useOptionalAgentControlStore();
  if (!store) throw new Error("Agent Control must be rendered inside GlobalAgentControlProvider");

  return store;
};

export const useAgentControl = <T,>(selector: (state: AgentControlState) => T): T => {
  const store = useAgentControlStore();

  return useStore(store, selector);
};
