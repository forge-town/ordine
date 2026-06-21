import { useCallback, useEffect } from "react";
import { useCreate, useList, type HttpError } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import type {
  ConversationMessage,
  ConversationMessageMetadata,
  CreateConversationMessageInput,
  ConversationRole,
  WorkspacePhase,
} from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useAgentBarStore, type AgentBarMessage } from "./_store";

type PersistConversationMessageInput = CreateConversationMessageInput & {
  id: string;
};

export type SendAgentMessageInput = {
  content: string;
  metadata?: ConversationMessageMetadata;
  role?: AgentBarMessage["role"];
};

export type UseAgentConversationPersistenceInput = {
  phase: WorkspacePhase;
  pipelineId: string | null;
};

const createMessageId = () =>
  `conversation-message-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toConversationRole = (role: AgentBarMessage["role"]): ConversationRole =>
  role === "assistant" ? "agent" : "user";

const toAgentBarRole = (role: ConversationRole): AgentBarMessage["role"] =>
  role === "user" ? "user" : "assistant";

export const toAgentBarMessage = (message: ConversationMessage): AgentBarMessage => ({
  content: message.content,
  id: message.id,
  metadata: message.metadata ?? undefined,
  phase: message.phase,
  role: toAgentBarRole(message.role),
});

export const useAgentConversationPersistence = ({
  phase,
  pipelineId,
}: UseAgentConversationPersistenceInput) => {
  const { result: conversationResult, query: conversationQuery } = useList<ConversationMessage>({
    filters: pipelineId
      ? [
          {
            field: "pipelineId",
            operator: "eq",
            value: pipelineId,
          },
        ]
      : [],
    queryOptions: { enabled: !!pipelineId, retry: false },
    resource: ResourceName.conversationMessages,
  });
  const { mutateAsync: createConversationMessage, mutation: createMutation } = useCreate<
    ConversationMessage,
    HttpError,
    PersistConversationMessageInput
  >();
  const addMessage = useAgentBarStore((state) => state.addMessage);
  const setMessages = useAgentBarStore((state) => state.setMessages);

  useEffect(() => {
    if (!pipelineId) {
      setMessages([]);

      return;
    }

    setMessages(conversationResult.data.map(toAgentBarMessage));
  }, [conversationResult.data, pipelineId, setMessages]);

  const sendMessage = useCallback(
    async ({ content, metadata, role = "user" }: SendAgentMessageInput) => {
      const trimmedContent = content.trim();

      if (!pipelineId || trimmedContent.length === 0) {
        return null;
      }

      const id = createMessageId();
      const optimisticMessage: AgentBarMessage = {
        content: trimmedContent,
        id,
        metadata,
        phase,
        role,
      };

      addMessage(optimisticMessage);

      const created = await ResultAsync.fromPromise(
        createConversationMessage({
          errorNotification: false,
          resource: ResourceName.conversationMessages,
          successNotification: false,
          values: {
            content: trimmedContent,
            id,
            metadata: metadata ?? null,
            phase,
            pipelineId,
            role: toConversationRole(role),
          },
        }),
        () => null,
      );

      if (created.isErr()) {
        return null;
      }

      if (conversationQuery?.refetch) {
        await ResultAsync.fromPromise(conversationQuery.refetch(), () => null);
      }

      return created.value.data;
    },
    [addMessage, conversationQuery, createConversationMessage, phase, pipelineId],
  );

  return {
    isLoading: conversationQuery?.isLoading ?? false,
    isSending: createMutation.isPending,
    sendMessage,
  };
};
