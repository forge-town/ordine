import { create } from "zustand";
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
  messages: AgentBarMessage[];
  addMessage: (message: AgentBarMessage) => void;
  clearMessages: () => void;
  resetAgentBar: () => void;
  setMessages: (messages: AgentBarMessage[]) => void;
};

const initialState = {
  messages: [],
};

export const useAgentBarStore = create<AgentBarState>((set) => ({
  ...initialState,
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages.filter((item) => item.id !== message.id), message],
    })),
  clearMessages: () => set({ messages: [] }),
  resetAgentBar: () => set(initialState),
  setMessages: (messages) => set({ messages }),
}));
