import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip, X } from "lucide-react";
import type { ConversationAttachment, ConversationMessageMetadata } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import type { WorkspaceCanvasRef } from "../../_store/workspaceStore";
import { Icon } from "@/components/primitives";
import { useAgentBarStore } from "../_store";
import { RefTagBar } from "./RefTagBar";

export type ComposerSubmitInput = {
  content: string;
  metadata: ConversationMessageMetadata;
};

export type ComposerProps = {
  isSending?: boolean;
  refs: WorkspaceCanvasRef[];
  onRemoveRef: (id: string) => void;
  onSubmit?: (input: ComposerSubmitInput) => unknown | Promise<unknown>;
};

const createMessageId = () => `agent-message-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const Composer = ({ isSending = false, onRemoveRef, onSubmit, refs }: ComposerProps) => {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ConversationAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMessage = useAgentBarStore((state) => state.addMessage);
  const trimmedText = text.trim();
  const canSend = (trimmedText.length > 0 || attachments.length > 0) && !isSending;
  const placeholder =
    refs.length > 0
      ? "Ask the Agent to change the referenced nodes..."
      : "Describe a goal, drop a sample, or revise...";

  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleAttachmentRemoveClick = (name: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.name !== name));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    setAttachments(files.map((file) => ({ name: file.name })));
    event.target.value = "";
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
        : `Reverse-engineer a pipeline from the attached sample: ${attachments
            .map((attachment) => attachment.name)
            .join(", ")}`;

    const metadata = {
      attachments,
      referencedNodeIds: refs.map((ref) => ref.id),
    };

    if (onSubmit) {
      void onSubmit({
        content,
        metadata,
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
    <div className="p-3 pt-2">
      <RefTagBar refs={refs} onRemoveRef={handleRemoveRef} />

      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pb-1.5">
          {attachments.map((attachment) => {
            const handleRemoveClick = () => handleAttachmentRemoveClick(attachment.name);

            return (
              <span
                key={attachment.name}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border"
              >
                <span className="truncate">{attachment.name}</span>
                <button
                  aria-label={`Remove ${attachment.name}`}
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
        <Button
          aria-label="Attach file"
          className="h-7 w-7 rounded-lg"
          size="icon"
          type="button"
          variant="ghost"
          onClick={handleAttachClick}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          ref={textareaRef}
          aria-label="Message"
          className="min-h-7 flex-1 resize-none border-none bg-transparent px-0 py-1 text-[12px] shadow-none focus-visible:ring-0"
          placeholder={placeholder}
          rows={1}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
        />
        <Button
          aria-label="Send message"
          className="h-7 w-7 rounded-full"
          disabled={!canSend}
          size="icon"
          type="button"
          onClick={handleSubmit}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
      <input
        ref={fileInputRef}
        multiple
        className="hidden"
        type="file"
        onChange={handleFileChange}
      />
      <div className="pt-1.5 text-center text-[10px] text-muted-foreground">
        Claude Code / Codex / Hermes available - $0.14 this session
      </div>
    </div>
  );
};
