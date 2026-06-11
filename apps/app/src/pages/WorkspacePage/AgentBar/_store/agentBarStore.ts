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
export const countAnchorsByRef = (
  messages: readonly AgentBarMessage[],
): Record<string, number> => {
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
