import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import { Assistant } from "./Assistant";
import { Bubble } from "./Bubble";
import { ClarifyOptions } from "./ClarifyOptions";
import { ErrorActions } from "./ErrorActions";
import { MessageActions } from "./MessageActions";
import { RefChips } from "../Composer";
import { buildMessageRefs } from "../messageView";
import type { AgentBarMessage } from "../_store";
import type { AgentConversationSubmitInput } from "../useAgentConversation";

type CanvasNodeLike = { id: string; data: { label?: string } };

export type MessageTurnProps = {
  canvasNodes: CanvasNodeLike[];
  hasPendingProposal: boolean;
  isLast: boolean;
  isSending: boolean;
  isThreadView: boolean;
  message: AgentBarMessage;
  /** 用于错误重试时定位该消息之前最近的一条用户消息。 */
  visibleMessages: AgentBarMessage[];
  onEditDraft: (content: string) => void;
  onOpenSettings: () => void;
  onResolveMessage: (message: AgentBarMessage) => void;
  onSubmit: (input: AgentConversationSubmitInput) => void;
};

/**
 * 单条消息气泡及其附属交互（refs / clarify 芯片 / 错误动作 / 复制编辑重试 / thread resolve）。
 * 自 AgentBar 抽出（H2-02），渲染逻辑零行为变化。
 */
export const MessageTurn = ({
  canvasNodes,
  hasPendingProposal,
  isLast,
  isSending,
  isThreadView,
  message,
  visibleMessages,
  onEditDraft,
  onOpenSettings,
  onResolveMessage,
  onSubmit,
}: MessageTurnProps) => {
  const { t } = useTranslation();
  const messageRefs = buildMessageRefs(message, canvasNodes);
  const resolvable = isThreadView && !message.metadata?.resolved && !message.isThinking;
  const clarifyOptions = message.metadata?.clarifyOptions ?? [];
  const showClarifyOptions =
    message.role === "assistant" && clarifyOptions.length > 0 && isLast && !hasPendingProposal;
  const errorCode = message.metadata?.proposeErrorCode;
  const showErrorActions = message.role === "assistant" && Boolean(errorCode) && isLast;

  const handleErrorRetry = () => {
    const messageIndex = visibleMessages.indexOf(message);
    const lastUserMessage = [...visibleMessages.slice(0, messageIndex)]
      .reverse()
      .find((candidate) => candidate.role === "user");
    if (!lastUserMessage) {
      return;
    }
    onSubmit({
      content: lastUserMessage.content,
      metadata: { referencedNodeIds: lastUserMessage.metadata?.referencedNodeIds ?? [] },
    });
  };
  const handleRetryMessage = () =>
    onSubmit({
      content: message.content,
      metadata: { referencedNodeIds: message.metadata?.referencedNodeIds ?? [] },
    });
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
          onRetry={message.role === "user" ? handleRetryMessage : undefined}
        />
      ) : null}
      {messageRefs.length > 0 ? (
        <div className={cn(message.role === "user" && "flex justify-end")}>
          <RefChips small refs={messageRefs} />
        </div>
      ) : null}
      {showClarifyOptions ? (
        <ClarifyOptions
          disabled={isSending}
          options={clarifyOptions}
          onSelect={(option) => onSubmit({ content: option, metadata: { referencedNodeIds: [] } })}
        />
      ) : null}
      {showErrorActions && errorCode ? (
        <ErrorActions
          code={errorCode}
          disabled={isSending}
          onOpenSettings={onOpenSettings}
          onRetry={handleErrorRetry}
        />
      ) : null}
      {resolvable ? (
        <button
          aria-label={t("workspace.agentBar.thread.resolve")}
          className="absolute -left-3 top-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/turn:opacity-100"
          data-testid={`agent-resolve-${message.id}`}
          title={t("workspace.agentBar.thread.resolve")}
          type="button"
          onClick={() => onResolveMessage(message)}
        >
          <Check className="size-3" />
        </button>
      ) : null}
    </div>
  );
};
