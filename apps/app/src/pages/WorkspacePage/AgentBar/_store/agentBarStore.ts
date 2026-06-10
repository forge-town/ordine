import { create } from "zustand";

export type AgentBarMessageRole = "assistant" | "user";

export type AgentBarMessage = {
  content: string;
  id: string;
  isThinking?: boolean;
  role: AgentBarMessageRole;
};

export type AgentBarState = {
  messages: AgentBarMessage[];
  addMessage: (message: AgentBarMessage) => void;
  clearMessages: () => void;
  resetAgentBar: () => void;
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
}));
