import { useTranslation } from "react-i18next";
import { Assistant } from "./Assistant";
import { Bubble } from "./Bubble";
import { ClarifyOptions } from "./ClarifyOptions";
import { ErrorActions } from "./ErrorActions";
import { ErrorCard } from "./ErrorCard";
import { MessageActions } from "./MessageActions";
import type { AgentBarMessage } from "../_store";

export type MessageTurnSubmitInput = {
  content: string;
  runtimeId: string;
};

export type MessageTurnProps = {
  isLast: boolean;
  isSending: boolean;
  message: AgentBarMessage;
  runtimeId: string | null;
  visibleMessages: AgentBarMessage[];
  onEditDraft: (content: string) => void;
  onOpenSettings: () => void;
  onSubmit: (input: MessageTurnSubmitInput) => void;
};

/**
 * Shared message presentation for the canvas panel. Product actions only use
 * the current session submit contract; attachments and canvas references are
 * intentionally not reconstructed when retrying an old message.
 */
export const MessageTurn = ({
  isLast,
  isSending,
  message,
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

  const submit = (content: string) => {
    if (runtimeId) {
      onSubmit({ content, runtimeId });
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
