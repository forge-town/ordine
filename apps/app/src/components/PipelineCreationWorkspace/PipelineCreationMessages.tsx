import { useTranslation } from "react-i18next";
import { Activity, CalendarClock, CircleAlert, Wrench, WandSparkles } from "lucide-react";
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

export interface PipelineCreationRuntimeActivity {
  id: string;
  kind: "thinking" | "tool" | "diagnostic" | "retry" | "usage" | "terminal";
  title: string;
  detail?: string;
  tone?: "default" | "warning" | "error";
}

interface PipelineCreationMessagesProps {
  attachments: PipelineCreationAttachment[];
  canRemoveAttachments: boolean;
  isHome: boolean;
  messages: PipelineCreationMessage[];
  proposal: PipelineAgentProposal | null;
  removingAttachmentId: string | null;
  runtimeActivity: PipelineCreationRuntimeActivity[];
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
  runtimeActivity,
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
      {runtimeActivity.length > 0 && (
        <div className="max-w-[92%] space-y-1.5 rounded-xl border border-border bg-surface-2 p-2.5">
          {runtimeActivity.map((activity) => {
            const Icon =
              activity.kind === "tool"
                ? Wrench
                : activity.tone === "warning" || activity.tone === "error"
                  ? CircleAlert
                  : Activity;

            return (
              <div
                key={activity.id}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground",
                  activity.tone === "warning" && "bg-amber-500/8 text-amber-700 dark:text-amber-300",
                  activity.tone === "error" && "bg-destructive/8 text-destructive",
                )}
              >
                <Icon className="mt-0.5 size-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-current">{activity.title}</p>
                  {activity.detail && (
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-all opacity-80">
                      {activity.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
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
                {proposal.schedule && (
                  <Badge className="max-w-full break-words" variant="outline">
                    <CalendarClock className="size-3" />
                    {t("home.proposalSchedule", {
                      cronExpression: proposal.schedule.cronExpression,
                    })}
                  </Badge>
                )}
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
