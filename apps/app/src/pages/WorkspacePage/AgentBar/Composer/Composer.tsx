import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { ArrowUp, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  AgentContextPayload,
  ConversationMessageMetadata,
  ProposeAttachment,
} from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import { useWorkspaceStore, type WorkspaceCanvasRef } from "../../_store/workspaceStore";
import { Icon } from "@/components/primitives";
import { useAgentBarStore } from "../_store";
import { AttachMenu } from "./AttachMenu";
import { ContextStrip } from "./ContextStrip";
import { readAttachments, toMetadataAttachment } from "./readAttachments";
import { RefChips } from "./RefChips";
import { formatBytes } from "@/lib/format";

export type ComposerSubmitInput = {
  content: string;
  metadata: ConversationMessageMetadata;
  /** 附件全文（仅走请求 payload，不落库）。metadata.attachments 只有元数据+excerpt。 */
  proposeAttachments?: ProposeAttachment[];
};

export type ComposerProps = {
  /** buildAgentContext 输出，ContextStrip 渲染与发送共用（N12-01）。 */
  agentContext: AgentContextPayload;
  isSending?: boolean;
  refs: WorkspaceCanvasRef[];
  onRemoveRef: (id: string) => void;
  onSubmit?: (input: ComposerSubmitInput) => unknown | Promise<unknown>;
};

const createMessageId = () => `agent-message-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const Composer = ({
  agentContext,
  isSending = false,
  onRemoveRef,
  onSubmit,
  refs,
}: ComposerProps) => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ProposeAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addMessage = useAgentBarStore((state) => state.addMessage);
  const composerFocusNonce = useWorkspaceStore((state) => state.composerFocusNonce);
  const composerDraft = useWorkspaceStore((state) => state.composerDraft);
  const setComposerDraft = useWorkspaceStore((state) => state.setComposerDraft);

  useEffect(() => {
    if (composerFocusNonce > 0) {
      textareaRef.current?.focus();
    }
  }, [composerFocusNonce]);

  useEffect(() => {
    if (composerDraft !== null) {
      setText(composerDraft);
      setComposerDraft(null);
      textareaRef.current?.focus();
    }
  }, [composerDraft, setComposerDraft]);
  const trimmedText = text.trim();
  const canSend = (trimmedText.length > 0 || attachments.length > 0) && !isSending;
  const placeholder =
    refs.length > 0
      ? t("workspace.agentBar.composer.placeholderWithRefs")
      : t("workspace.agentBar.composer.placeholder");

  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleAttachmentRemoveClick = (name: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.name !== name));
  };

  const handleAttach = async (files: File[]) => {
    const usedChars = attachments.reduce(
      (total, attachment) => total + (attachment.content?.length ?? 0),
      0,
    );
    const incoming = await readAttachments(files, usedChars);
    setAttachments((current) => {
      const known = new Set(current.map((attachment) => attachment.name));

      return [...current, ...incoming.filter((attachment) => !known.has(attachment.name))];
    });
  };

  const handleRemoveRef = (id: string) => onRemoveRef(id);

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(96, event.target.scrollHeight)}px`;
  };

  const handleSubmit = () => {
    if (!canSend) {
      return;
    }

    const content =
      trimmedText.length > 0
        ? trimmedText
        : t("workspace.agentBar.composer.reverseDefault", {
            names: attachments.map((attachment) => attachment.name).join(", "),
          });

    const metadata = {
      // DB 只存元数据+excerpt；全文经 proposeAttachments 走请求体（手册警告 6）。
      attachments: attachments.map(toMetadataAttachment),
      referencedNodeIds: refs.map((ref) => ref.id),
    };

    if (onSubmit) {
      void onSubmit({
        content,
        metadata,
        proposeAttachments: attachments,
      });
    } else {
      addMessage({
        content,
        id: createMessageId(),
        metadata,
        role: "user",
      });
    }

    setText("");
    setAttachments([]);
    resetTextareaHeight();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div>
      <ContextStrip context={agentContext} />
      <div className="p-3 pt-2">
        <RefChips refs={refs} onRemoveRef={handleRemoveRef} />

        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pb-1.5">
            {attachments.map((attachment) => {
              const handleRemoveClick = () => handleAttachmentRemoveClick(attachment.name);

              return (
                <span
                  key={attachment.name}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border"
                  data-testid="agent-composer-attachment-chip"
                >
                  <span className="truncate">{attachment.name}</span>
                  {attachment.size !== undefined ? (
                    <span className="shrink-0 text-muted-foreground/70">
                      {formatBytes(attachment.size)}
                    </span>
                  ) : null}
                  {attachment.content === undefined ? (
                    <span
                      className="shrink-0 rounded-full bg-foreground/10 px-1 text-[9px]"
                      title={t("workspace.agentBar.composer.nameOnlyHint")}
                    >
                      {t("workspace.agentBar.composer.nameOnly")}
                    </span>
                  ) : null}
                  <button
                    aria-label={t("workspace.agentBar.composer.removeAttachment", {
                      name: attachment.name,
                    })}
                    className="rounded-full p-0.5 hover:bg-foreground/10"
                    type="button"
                    onClick={handleRemoveClick}
                  >
                    <Icon icon={X} size={9} />
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}

        <div className="flex items-end gap-1.5 rounded-2xl bg-background p-2 ring-1 ring-border focus-within:ring-border-strong">
          <AttachMenu onAttach={handleAttach} />
          <Textarea
            ref={textareaRef}
            aria-label={t("workspace.agentBar.composer.messageLabel")}
            className="min-h-7 flex-1 resize-none border-none bg-transparent px-0 py-1 text-[12px] shadow-none focus-visible:ring-0"
            placeholder={placeholder}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
          />
          <Button
            aria-label={t("workspace.agentBar.composer.send")}
            className="h-7 w-7 rounded-full"
            disabled={!canSend}
            size="icon"
            type="button"
            onClick={handleSubmit}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
