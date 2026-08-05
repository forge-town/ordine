import { useCallback, useEffect } from "react";
import { useCreate, useList, type HttpError } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import type {
  ConversationMessage,
  ConversationMessageMetadata,
  ConversationRole,
  CreateConversationMessageInput,
} from "@repo/schemas";
import { ResourceName } from "../../../constants";
import { useAgentBarStore } from "./_store";
import { HISTORY_WINDOW_LIMIT } from "./context";

type PersistConversationMessageInput = CreateConversationMessageInput & {
  id: string;
};

export type SendAgentMessageInput = {
  content: string;
  metadata?: ConversationMessageMetadata;
  phase?: string;
  role?: "assistant" | "user";
};

const createMessageId = () =>
  `conversation-message-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toConversationRole = (role: "assistant" | "user"): ConversationRole =>
  role === "assistant" ? "agent" : "user";

export const toAgentBarMessage = (message: ConversationMessage) => ({
  content: message.content,
  id: message.id,
  metadata: message.metadata ?? undefined,
  phase: message.phase,
  role: message.role === "user" ? ("user" as const) : ("assistant" as const),
});

export const useAgentConversationPersistence = ({
  phase,
  pipelineId,
}: {
  phase: string;
  pipelineId: string | null;
}) => {
  const { result: conversationResult, query: conversationQuery } = useList<ConversationMessage>({
    filters: pipelineId
      ? [
          { field: "pipelineId", operator: "eq", value: pipelineId },
          { field: "limit", operator: "eq", value: HISTORY_WINDOW_LIMIT },
        ]
      : [],
    queryOptions: { enabled: Boolean(pipelineId), retry: false },
    resource: ResourceName.conversationMessages,
  });
  const { mutateAsync: createConversationMessage, mutation: createMutation } = useCreate<
    ConversationMessage,
    HttpError,
    PersistConversationMessageInput
  >();
  const addMessage = useAgentBarStore((state) => state.addMessage);
  const removeMessage = useAgentBarStore((state) => state.removeMessage);
  const setMessages = useAgentBarStore((state) => state.setMessages);

  useEffect(() => {
    if (!pipelineId) {
      setMessages([]);

      return;
    }

    setMessages(conversationResult.data.map(toAgentBarMessage));
  }, [conversationResult.data, pipelineId, setMessages]);

  const sendMessage = useCallback(
    async ({ content, metadata, phase: messagePhase, role = "user" }: SendAgentMessageInput) => {
      const trimmedContent = content.trim();
      if (!pipelineId || trimmedContent.length === 0) {
        return null;
      }

      const id = createMessageId();
      addMessage({ content: trimmedContent, id, metadata, phase: messagePhase ?? phase, role });

      const created = await ResultAsync.fromPromise(
        createConversationMessage({
          errorNotification: false,
          resource: ResourceName.conversationMessages,
          successNotification: false,
          values: {
            content: trimmedContent,
            id,
            metadata: metadata ?? null,
            phase: messagePhase ?? phase,
            pipelineId,
            role: toConversationRole(role),
          },
        }),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      );

      if (created.isErr()) {
        removeMessage(id);

        return null;
      }

      if (conversationQuery?.refetch) {
        await ResultAsync.fromPromise(conversationQuery.refetch(), (error) =>
          error instanceof Error ? error : new Error(String(error)),
        );
      }

      return created.value.data;
    },
    [addMessage, conversationQuery, createConversationMessage, phase, pipelineId, removeMessage],
  );

  return {
    isLoading: conversationQuery?.isLoading ?? false,
    isSending: createMutation.isPending,
    sendMessage,
  };
};
