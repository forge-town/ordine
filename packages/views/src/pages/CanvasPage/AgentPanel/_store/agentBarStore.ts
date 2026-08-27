import { createContext, createElement, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { ConversationMessageMetadata, PipelineGenerationPlan } from "@repo/schemas";
import {
  appendAgentActivity,
  type AgentActivityEntry,
} from "../../../../components/AgentActivityFeed";

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
  activeRunId: string | null;
  conversationState: AgentConversationState;
  /** COD-346:空画布 generate 会话产生的建图方案(与画布 edit 提案互斥)。 */
  generateProposal: PipelineGenerationPlan | null;
  messages: AgentBarMessage[];
  pipelineId: string | null;
  proposalId: string | null;
  sessionGraphSignature: string | null;
  sessionId: string | null;
  streamingAssistantText: string;
  streamingActivities: AgentActivityEntry[];
  streamingProgress: string | null;
  addMessage: (message: AgentBarMessage) => void;
  appendStreamingAssistantText: (text: string) => void;
  appendStreamingActivity: (activity: AgentActivityEntry) => void;
  clearMessages: () => void;
  removeMessage: (id: string) => void;
  resetAgentBar: () => void;
  resetSession: () => void;
  resolveMessage: (id: string) => void;
  setConversationState: (state: AgentConversationState) => void;
  setActiveRunId: (runId: string | null) => void;
  setGenerateProposal: (proposal: PipelineGenerationPlan | null) => void;
  setMessages: (messages: AgentBarMessage[]) => void;
  setProposalId: (proposalId: string | null) => void;
  setSession: (sessionId: string, graphSignature: string) => void;
  setStreamingAssistantText: (text: string) => void;
  setStreamingActivities: (activities: AgentActivityEntry[]) => void;
  setStreamingProgress: (progress: string | null) => void;
};

const initialSessionState = {
  activeRunId: null,
  generateProposal: null,
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
    streamingActivities: [],
    streamingProgress: null,
    addMessage: (message) =>
      set((state) => ({
        messages: [...state.messages.filter((item) => item.id !== message.id), message],
      })),
    appendStreamingAssistantText: (text) =>
      set((state) => ({
        streamingAssistantText: `${state.streamingAssistantText}${text}`,
      })),
    appendStreamingActivity: (activity) =>
      set((state) => ({
        streamingActivities: appendAgentActivity(state.streamingActivities, activity),
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
        streamingActivities: [],
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
    setActiveRunId: (activeRunId) => set({ activeRunId }),
    setGenerateProposal: (generateProposal) => set({ generateProposal }),
    setMessages: (messages) => set({ messages }),
    setProposalId: (proposalId) => set({ proposalId }),
    setSession: (sessionId, sessionGraphSignature) =>
      set({ sessionId, sessionGraphSignature, generateProposal: null, proposalId: null }),
    setStreamingAssistantText: (streamingAssistantText) => set({ streamingAssistantText }),
    setStreamingActivities: (streamingActivities) => set({ streamingActivities }),
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
