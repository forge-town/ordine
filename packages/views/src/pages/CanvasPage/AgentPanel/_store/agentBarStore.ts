import { createContext, createElement, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { ConversationMessageMetadata } from "@repo/schemas";

export type AgentConversationState = "idle" | "thinking" | "streaming" | "done";

export type AgentBarMessage = {
  content: string;
  id: string;
  isThinking?: boolean;
  metadata?: ConversationMessageMetadata;
  phase?: string | null;
  role: "assistant" | "user";
};

export type AgentBarState = {
  conversationState: AgentConversationState;
  messages: AgentBarMessage[];
  pipelineId: string | null;
  proposalId: string | null;
  sessionGraphSignature: string | null;
  sessionId: string | null;
  streamingAssistantText: string;
  streamingProgress: string | null;
  addMessage: (message: AgentBarMessage) => void;
  appendStreamingAssistantText: (text: string) => void;
  clearMessages: () => void;
  removeMessage: (id: string) => void;
  resetAgentBar: () => void;
  resetSession: () => void;
  resolveMessage: (id: string) => void;
  setConversationState: (state: AgentConversationState) => void;
  setMessages: (messages: AgentBarMessage[]) => void;
  setProposalId: (proposalId: string | null) => void;
  setSession: (sessionId: string, graphSignature: string) => void;
  setStreamingAssistantText: (text: string) => void;
  setStreamingProgress: (progress: string | null) => void;
};

const initialSessionState = {
  proposalId: null,
  sessionGraphSignature: null,
  sessionId: null,
} as const;

export type AgentBarStore = StoreApi<AgentBarState>;

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

export const createAgentBarStore = (pipelineId: string | null = null): AgentBarStore =>
  createStore<AgentBarState>((set) => ({
    conversationState: "idle",
    messages: [],
    pipelineId,
    ...initialSessionState,
    streamingAssistantText: "",
    streamingProgress: null,
    addMessage: (message) =>
      set((state) => ({
        messages: [...state.messages.filter((item) => item.id !== message.id), message],
      })),
    appendStreamingAssistantText: (text) =>
      set((state) => ({
        streamingAssistantText:
          state.streamingAssistantText.length === 0
            ? text
            : `${state.streamingAssistantText}\n${text}`,
      })),
    clearMessages: () => set({ messages: [] }),
    removeMessage: (id) =>
      set((state) => ({ messages: state.messages.filter((message) => message.id !== id) })),
    resetAgentBar: () =>
      set({
        conversationState: "idle",
        messages: [],
        ...initialSessionState,
        streamingAssistantText: "",
        streamingProgress: null,
      }),
    resetSession: () => set(initialSessionState),
    resolveMessage: (id) =>
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === id
            ? { ...message, metadata: { ...message.metadata, resolved: true } }
            : message,
        ),
      })),
    setConversationState: (conversationState) => set({ conversationState }),
    setMessages: (messages) => set({ messages }),
    setProposalId: (proposalId) => set({ proposalId }),
    setSession: (sessionId, sessionGraphSignature) =>
      set({ sessionId, sessionGraphSignature, proposalId: null }),
    setStreamingAssistantText: (streamingAssistantText) => set({ streamingAssistantText }),
    setStreamingProgress: (streamingProgress) => set({ streamingProgress }),
  }));

export const AgentBarStoreContext = createContext<AgentBarStore | null>(null);

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

export const useAgentBarStoreApi = (): AgentBarStore => {
  const store = useContext(AgentBarStoreContext);
  if (!store) {
    throw new Error("useAgentBarStore must be used within AgentBarStoreProvider");
  }

  return store;
};

export const useAgentBarStore = <T>(selector: (state: AgentBarState) => T): T =>
  useStore(useAgentBarStoreApi(), selector);
