import { createContext, createElement, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { ConversationMessageMetadata, WorkspacePhase } from "@repo/schemas";

export type AgentBarMessageRole = "assistant" | "user";

export type AgentBarMessage = {
  content: string;
  id: string;
  isThinking?: boolean;
  metadata?: ConversationMessageMetadata;
  phase?: WorkspacePhase | string | null;
  role: AgentBarMessageRole;
};

export type AgentBarState = {
  /** 该 store 实例所属的 pipeline；Provider 据此在切换 pipeline 时重建，消除消息串扰（H2-03/G1-04）。 */
  pipelineId: string | null;
  messages: AgentBarMessage[];
  addMessage: (message: AgentBarMessage) => void;
  clearMessages: () => void;
  resetAgentBar: () => void;
  resolveMessage: (id: string) => void;
  setMessages: (messages: AgentBarMessage[]) => void;
};

/** Unresolved messages anchored to a canvas ref id — drives node badges. */
export const countUnresolvedAnchors = (
  messages: readonly AgentBarMessage[],
  refId: string,
): number =>
  messages.filter(
    (message) =>
      !message.metadata?.resolved &&
      !message.isThinking &&
      (message.metadata?.referencedNodeIds ?? []).includes(refId),
  ).length;

/** 按 refId 汇总未解决锚点 — 由 AnchorCountSync 写入 workspaceStore，canvas 只从那里读（G1-03）。 */
export const countAnchorsByRef = (messages: readonly AgentBarMessage[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const message of messages) {
    if (message.metadata?.resolved || message.isThinking) {
      continue;
    }
    for (const refId of message.metadata?.referencedNodeIds ?? []) {
      counts[refId] = (counts[refId] ?? 0) + 1;
    }
  }

  return counts;
};

export type AgentBarStore = StoreApi<AgentBarState>;

export const createAgentBarStore = (pipelineId: string | null = null): AgentBarStore =>
  createStore<AgentBarState>((set) => ({
    pipelineId,
    messages: [],
    addMessage: (message) =>
      set((state) => ({
        messages: [...state.messages.filter((item) => item.id !== message.id), message],
      })),
    clearMessages: () => set({ messages: [] }),
    resetAgentBar: () => set({ messages: [] }),
    resolveMessage: (id) =>
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === id
            ? { ...message, metadata: { ...message.metadata, resolved: true } }
            : message,
        ),
      })),
    setMessages: (messages) => set({ messages }),
  }));

const defaultAgentBarStore = createAgentBarStore(null);
const AgentBarStoreContext = createContext<AgentBarStore | null>(null);

export const AgentBarStoreProvider = ({
  children,
  pipelineId,
}: {
  children: ReactNode;
  pipelineId: string | null;
}) => {
  const storeRef = useRef<AgentBarStore | null>(null);

  if (!storeRef.current || storeRef.current.getState().pipelineId !== pipelineId) {
    storeRef.current = createAgentBarStore(pipelineId);
  }

  return createElement(AgentBarStoreContext.Provider, { value: storeRef.current }, children);
};

const useAgentBarStoreSelector = <T>(selector: (state: AgentBarState) => T): T => {
  const store = useContext(AgentBarStoreContext) ?? defaultAgentBarStore;

  return useStore(store, selector);
};

export const useAgentBarStore = Object.assign(useAgentBarStoreSelector, {
  getState: defaultAgentBarStore.getState,
  setState: defaultAgentBarStore.setState,
  subscribe: defaultAgentBarStore.subscribe,
});
