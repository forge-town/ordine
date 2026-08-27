import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Loader2, X } from "lucide-react";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";

export interface PipelineCreationAttachment {
  id: string;
  filename: string;
  parseError?: string | null;
  parseStatus: string;
}

interface PipelineCreationAttachmentsProps {
  attachments: PipelineCreationAttachment[];
  canRemove: boolean;
  isHome: boolean;
  removingAttachmentId: string | null;
  onRemove: (attachmentId: string) => void;
}

export const PipelineCreationAttachments = ({
  attachments,
  canRemove,
  isHome,
  removingAttachmentId,
  onRemove,
}: PipelineCreationAttachmentsProps) => {
  const { t } = useTranslation();
  const handleRemoveClick = (event: MouseEvent<HTMLButtonElement>) => {
    const attachmentId = event.currentTarget.dataset.attachmentId;
    if (attachmentId) {
      onRemove(attachmentId);
    }
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment) => {
        const failed = attachment.parseStatus === "failed";

        return (
          <div
            key={attachment.id}
            className={cn(
              "flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs",
              failed
                ? "border-destructive/35 bg-destructive/8 text-destructive"
                : "border-border bg-secondary text-secondary-foreground",
            )}
            title={attachment.parseError ?? undefined}
          >
            {isHome && <FileText className="size-3 shrink-0" />}
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
              {attachment.filename}
            </span>
            <span className="shrink-0 text-[10px] opacity-70">
              {failed
                ? t("newPipelineDialog.attachmentFailed")
                : t("newPipelineDialog.attachmentReady")}
            </span>
            <Button
              aria-label={t("newPipelineDialog.removeAttachment", {
                name: attachment.filename,
              })}
              className="size-5 shrink-0 rounded-full"
              data-attachment-id={attachment.id}
              disabled={!canRemove || removingAttachmentId === attachment.id}
              size="icon-xs"
              type="button"
              variant="ghost"
              onClick={handleRemoveClick}
            >
              {removingAttachmentId === attachment.id ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <X className="size-3" />
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
};
