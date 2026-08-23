import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { ArrowUp, Square, X } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useTranslation } from "react-i18next";
import type {
  AgentContextPayload,
  ConversationMessageMetadata,
  ProposeAttachment,
  WorkspaceCanvasRef,
} from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import { Icon } from "../../../../components/primitives";
import { AttachMenu } from "./AttachMenu";
import { ContextStrip } from "./ContextStrip";
import { RefChips } from "./RefChips";

export type ComposerSubmitInput = {
  content: string;
  metadata: ConversationMessageMetadata;
};

export type ComposerProps = {
  agentContext: AgentContextPayload;
  attachments?: ProposeAttachment[];
  canRemoveAttachments?: boolean;
  clearAttachmentsOnSubmit?: boolean;
  contextDefaultOpen?: boolean;
  defaultAttachments?: ProposeAttachment[];
  disabled?: boolean;
  draft?: string | null;
  isSending?: boolean;
  isStopping?: boolean;
  onAttach?: (files: File[]) => ProposeAttachment[] | void | Promise<ProposeAttachment[] | void>;
  onDraftConsumed?: () => void;
  onFocusRef?: (ref: WorkspaceCanvasRef) => void;
  onRemoveRef: (id: string) => void;
  onSubmit?: (input: ComposerSubmitInput) => boolean | void | Promise<boolean | void>;
  onStop?: () => boolean | void | Promise<boolean | void>;
  refs: WorkspaceCanvasRef[];
  resetKey?: string;
  runtimeId?: string | null;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const toMetadataAttachment = ({ content: _content, ...metadata }: ProposeAttachment) => metadata;

export const Composer = ({
  agentContext,
  attachments: controlledAttachments,
  canRemoveAttachments = true,
  clearAttachmentsOnSubmit = true,
  contextDefaultOpen = false,
  defaultAttachments = [],
  disabled = false,
  draft = null,
  isSending = false,
  isStopping = false,
  onAttach,
  onDraftConsumed,
  onFocusRef,
  onRemoveRef,
  onSubmit,
  onStop,
  refs,
  resetKey,
  runtimeId,
}: ComposerProps) => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localAttachments, setLocalAttachments] = useState<ProposeAttachment[]>(defaultAttachments);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousResetKeyRef = useRef(resetKey);
  const attachments = controlledAttachments ?? localAttachments;
  const isDisabled = disabled || isSending;

  useEffect(() => {
    if (draft !== null) {
      setText(draft);
      onDraftConsumed?.();
      textareaRef.current?.focus();
    }
  }, [draft, onDraftConsumed]);

  useEffect(() => {
    if (previousResetKeyRef.current !== resetKey) {
      previousResetKeyRef.current = resetKey;
      setLocalAttachments([]);
    }
  }, [resetKey]);

  const setAttachments = (next: ProposeAttachment[]) => {
    if (controlledAttachments === undefined) {
      setLocalAttachments(next);
    }
  };

  const trimmedText = text.trim();
  const canSend =
    Boolean(runtimeId) &&
    !isDisabled &&
    !isSubmitting &&
    (trimmedText.length > 0 || attachments.length > 0);
  const canStop = isSending && Boolean(onStop) && !isStopping;
  const placeholder =
    refs.length > 0
      ? t("workspace.agentBar.composer.placeholderWithRefs")
      : t("workspace.agentBar.composer.placeholder");

  const handleAttachmentRemoveClick = (name: string) => {
    setAttachments(attachments.filter((attachment) => attachment.name !== name));
  };

  const handleAttach = async (files: File[]) => {
    if (!onAttach || isDisabled) {
      return;
    }
    const known = new Set(attachments.map((attachment) => attachment.name));
    const newFiles = files.filter((file) => !known.has(file.webkitRelativePath || file.name));
    if (newFiles.length === 0) {
      return;
    }

    const incoming = await onAttach(newFiles);
    if (!incoming || incoming.length === 0) {
      return;
    }
    setAttachments([
      ...attachments,
      ...incoming.filter((attachment) => !known.has(attachment.name)),
    ]);
  };

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(96, event.target.scrollHeight)}px`;
  };

  const handleSubmit = async () => {
    if (!canSend) {
      return;
    }
    setIsSubmitting(true);
    const content =
      trimmedText.length > 0
        ? trimmedText
        : t("workspace.agentBar.composer.reverseDefault", {
            names: attachments.map((attachment) => attachment.name).join(", "),
          });
    const metadata: ConversationMessageMetadata = {
      attachments: attachments.map(toMetadataAttachment),
      referencedNodeIds: refs.map((ref) => ref.id),
    };

    const submitResult = await ResultAsync.fromPromise(
      Promise.resolve().then(() => onSubmit?.({ content, metadata })),
      () => "submit-failed" as const,
    );
    setIsSubmitting(false);
    if (submitResult.isErr() || submitResult.value === false) {
      return;
    }

    setText("");
    if (clearAttachmentsOnSubmit) {
      setAttachments([]);
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div data-testid="agent-composer">
      <ContextStrip context={agentContext} defaultOpen={contextDefaultOpen} />
      <div className="p-3 pt-2">
        <RefChips refs={refs} onFocusRef={onFocusRef} onRemoveRef={onRemoveRef} />
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pb-1.5">
            {attachments.map((attachment) => (
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
                {canRemoveAttachments ? (
                  <button
                    aria-label={t("workspace.agentBar.composer.removeAttachment", {
                      name: attachment.name,
                    })}
                    className="rounded-full p-0.5 hover:bg-foreground/10"
                    type="button"
                    onClick={() => handleAttachmentRemoveClick(attachment.name)}
                  >
                    <Icon icon={X} size={9} />
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-1.5 rounded-2xl bg-background p-2 ring-1 ring-border focus-within:ring-border-strong">
          <AttachMenu disabled={isDisabled || !onAttach} onAttach={handleAttach} />
          <Textarea
            ref={textareaRef}
            aria-label={t("workspace.agentBar.composer.messageLabel")}
            className="min-h-7 flex-1 resize-none border-none bg-transparent px-0 py-1 text-[12px] shadow-none focus-visible:ring-0 disabled:bg-transparent dark:disabled:bg-transparent"
            disabled={isDisabled}
            id="canvas-agent-composer-message"
            name="canvasAgentMessage"
            placeholder={placeholder}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
          />
          <Button
            aria-label={
              isSending
                ? t("workspace.agentBar.composer.stop")
                : t("workspace.agentBar.composer.send")
            }
            className="h-7 w-7 rounded-full"
            data-testid="agent-composer-send"
            disabled={isSending ? !canStop : !canSend}
            size="icon"
            type="button"
            onClick={() => {
              if (isSending) {
                void onStop?.();

                return;
              }
              void handleSubmit();
            }}
          >
            {isSending ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
