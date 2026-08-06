import { useTranslation } from "react-i18next";
import type { ConversationMessageMetadata, WorkspaceCanvasRef } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";
import { Assistant } from "./Assistant";
import { Bubble } from "./Bubble";
import { ClarifyOptions } from "./ClarifyOptions";
import { ErrorActions } from "./ErrorActions";
import { ErrorCard } from "./ErrorCard";
import { MessageActions } from "./MessageActions";
import type { AgentBarMessage } from "../_store";
import { RefChips } from "../Composer";

export type MessageTurnSubmitInput = {
  content: string;
  metadata?: ConversationMessageMetadata;
  runtimeId: string;
};

export type MessageTurnProps = {
  isLast: boolean;
  isSending: boolean;
  message: AgentBarMessage;
  refs: WorkspaceCanvasRef[];
  runtimeId: string | null;
  visibleMessages: AgentBarMessage[];
  onEditDraft: (content: string) => void;
  onOpenSettings: () => void;
  onSubmit: (input: MessageTurnSubmitInput) => void;
};

/**
 * Shared message presentation for the canvas panel. Historical references are
 * resolved against the current canvas when possible and otherwise shown by id.
 */
export const MessageTurn = ({
  isLast,
  isSending,
  message,
  refs,
  runtimeId,
  visibleMessages,
  onEditDraft,
  onOpenSettings,
  onSubmit,
}: MessageTurnProps) => {
  const { t } = useTranslation();
  const clarifyOptions = message.metadata?.clarifyOptions ?? [];
  const errorCode = message.metadata?.proposeErrorCode;
  const errorContext = message.metadata?.errorContext;
  const showClarifyOptions =
    message.role === "assistant" && clarifyOptions.length > 0 && isLast && !isSending;
  const showErrorActions = message.role === "assistant" && Boolean(errorCode) && isLast;

  const messageRefs = (message.metadata?.referencedNodeIds ?? []).map((id) => {
    const currentRef = refs.find((ref) => ref.id === id);
    if (currentRef) {
      return currentRef;
    }

    return {
      baseId: id,
      id,
      kind: "node",
      label: id,
      path: [],
      type: "node" as const,
    } satisfies WorkspaceCanvasRef;
  });

  const submit = (content: string, metadata?: ConversationMessageMetadata) => {
    if (runtimeId) {
      onSubmit(metadata ? { content, metadata, runtimeId } : { content, runtimeId });
    }
  };

  const handleErrorRetry = () => {
    const messageIndex = visibleMessages.indexOf(message);
    const lastUserMessage = [...visibleMessages.slice(0, messageIndex)]
      .reverse()
      .find((candidate) => candidate.role === "user");
    if (lastUserMessage) {
      submit(lastUserMessage.content);
    }
  };

  const body =
    message.role === "user" ? (
      <Bubble attachmentLabel={message.metadata?.attachments?.map((item) => item.name).join(", ")}>
        {message.content}
      </Bubble>
    ) : (
      <Assistant isThinking={message.isThinking}>{message.content}</Assistant>
    );

  return (
    <div className="group/turn relative space-y-1">
      {body}
      {messageRefs.length > 0 ? (
        <div className={cn(message.role === "user" && "flex justify-end")}>
          <RefChips refs={messageRefs} small />
        </div>
      ) : null}
      {!message.isThinking && message.content.trim().length > 0 ? (
        <MessageActions
          align={message.role === "user" ? "right" : "left"}
          content={message.content}
          disabled={isSending}
          onEdit={message.role === "user" ? () => onEditDraft(message.content) : undefined}
          onRetry={message.role === "user" && runtimeId ? () => submit(message.content) : undefined}
        />
      ) : null}
      {showClarifyOptions ? (
        <ClarifyOptions
          disabled={isSending || !runtimeId}
          options={clarifyOptions}
          onSelect={submit}
        />
      ) : null}
      {errorContext ? (
        <ErrorCard
          title={t("canvas.agentPanel.error.title")}
          tryLabel={errorContext.try}
          what={errorContext.what}
          why={errorContext.why}
          onAction={errorCode === "RUNTIME_NOT_FOUND" ? onOpenSettings : undefined}
        />
      ) : null}
      {showErrorActions && errorCode ? (
        <ErrorActions
          code={errorCode}
          disabled={isSending || (!runtimeId && errorCode !== "RUNTIME_NOT_FOUND")}
          onOpenSettings={onOpenSettings}
          onRetry={handleErrorRetry}
        />
      ) : null}
    </div>
  );
};
