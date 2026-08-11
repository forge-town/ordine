import { useTranslation } from "react-i18next";
import { WandSparkles } from "lucide-react";
import { Badge } from "@repo/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import type { PipelineAgentProposal } from "@repo/schemas";
import {
  PipelineCreationAttachments,
  type PipelineCreationAttachment,
} from "./PipelineCreationAttachments";

export interface PipelineCreationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface PipelineCreationMessagesProps {
  attachments: PipelineCreationAttachment[];
  canRemoveAttachments: boolean;
  isHome: boolean;
  messages: PipelineCreationMessage[];
  proposal: PipelineAgentProposal | null;
  removingAttachmentId: string | null;
  streamingAssistantText: string;
  onRemoveAttachment: (attachmentId: string) => void;
}

export const PipelineCreationMessages = ({
  attachments,
  canRemoveAttachments,
  isHome,
  messages,
  proposal,
  removingAttachmentId,
  streamingAssistantText,
  onRemoveAttachment: handleRemoveAttachment,
}: PipelineCreationMessagesProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "min-h-0 space-y-3 overflow-y-auto pr-1",
        isHome ? "max-h-[min(40vh,360px)]" : "max-h-[38vh]",
      )}
    >
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "max-w-[88%] break-words rounded-xl px-3.5 py-2.5 text-sm leading-6 [overflow-wrap:anywhere]",
            message.role === "user"
              ? "ml-auto bg-foreground text-background"
              : message.role === "system"
                ? "border border-dashed border-border bg-surface-2 text-muted-foreground"
                : "border border-border bg-card text-foreground",
          )}
        >
          {message.content}
        </div>
      ))}
      {streamingAssistantText && (
        <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-xl border border-dashed border-border bg-card px-3.5 py-2.5 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
          {streamingAssistantText}
        </div>
      )}
      <PipelineCreationAttachments
        attachments={attachments}
        canRemove={canRemoveAttachments}
        isHome={isHome}
        removingAttachmentId={removingAttachmentId}
        onRemove={handleRemoveAttachment}
      />
      {proposal?.mode === "generate" && (
        <div className="max-w-full rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
          <div className="flex items-start gap-3">
            {isHome && (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <WandSparkles className="size-4" />
              </span>
            )}
            <div className="min-w-0 space-y-3">
              <div>
                <p className="break-words font-semibold text-foreground [overflow-wrap:anywhere]">
                  {proposal.purpose}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("home.proposalHint")}
                </p>
              </div>
              <div className="flex max-w-full flex-wrap gap-1.5">
                {proposal.inputs.map((input) => (
                  <Badge
                    key={`input-${input}`}
                    className="max-w-full break-words"
                    variant="outline"
                  >
                    {input}
                  </Badge>
                ))}
                {proposal.outputs.map((output) => (
                  <Badge
                    key={`output-${output}`}
                    className="max-w-full break-words"
                    variant="secondary"
                  >
                    {output}
                  </Badge>
                ))}
              </div>
              <p className="break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                {proposal.majorOperations.join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
