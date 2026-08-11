import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ResultAsync } from "neverthrow";
import {
  AlertCircle,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  Play,
  Plus,
  Sparkles,
  Upload,
  WandSparkles,
  Workflow,
  X,
} from "lucide-react";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Textarea } from "@repo/ui/textarea";
import type { PipelineAgentProposal } from "@repo/schemas";
import { sidebarStore as sharedSidebarStore } from "@repo/views/store/sidebarStore";
import { dataProvider } from "@/integrations/refine/dataProvider";
import { materializeGeneratedPipeline } from "@/lib/materializeGeneratedPipeline";
import {
  pipelineAgentSessionsClient,
  type PipelineAgentPlanEvent,
} from "@/lib/pipelineAgentSessionsClient";
import { router } from "@/router";

type WorkspacePresentation = "dialog" | "home";

interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface AttachmentItem {
  id: string;
  filename: string;
  parseError?: string | null;
  parseStatus: string;
}

export interface PipelineCreationWorkspaceProps {
  active: boolean;
  client?: typeof pipelineAgentSessionsClient;
  materializePipeline?: typeof materializeGeneratedPipeline;
  presentation?: WorkspacePresentation;
  runtimeConnected?: boolean;
  runtimeId?: string;
  runtimeLabel?: string;
  onClose?: () => void;
}

export const PipelineCreationWorkspace = ({
  active,
  client = pipelineAgentSessionsClient,
  materializePipeline = materializeGeneratedPipeline,
  presentation = "dialog",
  runtimeConnected = false,
  runtimeId,
  runtimeLabel,
  onClose: handleClose,
}: PipelineCreationWorkspaceProps) => {
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<string | null>(null);
  const [createdPipelineId, setCreatedPipelineId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [phase, setPhase] = useState<
    "conversation" | "planning" | "proposal_ready" | "generating" | "success"
  >("conversation");
  const [proposal, setProposal] = useState<PipelineAgentProposal | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [streamingAssistantText, setStreamingAssistantText] = useState("");
  const sessionIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isHome = presentation === "home";
  const welcomeMessage = t("newPipelineDialog.welcome");

  const resetWorkspace = useCallback(() => {
    sessionIdRef.current = null;
    setAttachments([]);
    setIsUploading(false);
    setRemovingAttachmentId(null);
    setCreatedPipelineId(null);
    setErrorMessage(null);
    setInputValue("");
    setMessages([]);
    setPhase("conversation");
    setProposal(null);
    setProposalId(null);
    setStreamingAssistantText("");
  }, []);

  const displayName = useMemo(() => {
    if (proposal?.mode === "generate") {
      return proposal.purpose;
    }

    return createdPipelineId ?? t("pipelines.createNew");
  }, [createdPipelineId, proposal, t]);
  const isProposalReadyForApproval =
    proposal?.mode === "generate" && proposal.readiness === "ready_for_generation";
  const hasConversation =
    messages.length > 0 ||
    streamingAssistantText.length > 0 ||
    attachments.length > 0 ||
    proposal !== null;

  useEffect(() => {
    if (!active) {
      resetWorkspace();

      return;
    }

    if (!isHome) {
      setMessages((currentMessages) =>
        currentMessages.length === 1 && currentMessages[0]?.content === welcomeMessage
          ? currentMessages
          : [
              {
                id: "welcome",
                role: "assistant",
                content: welcomeMessage,
              },
            ],
      );
    }
  }, [active, isHome, resetWorkspace, welcomeMessage]);

  const handleMessageInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
  };

  const ensureSession = async () => {
    if (sessionIdRef.current) {
      return sessionIdRef.current;
    }

    const session = await client.createSession({
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
    });
    sessionIdRef.current = session.id;

    return session.id;
  };

  const handleEvent = (event: PipelineAgentPlanEvent) => {
    if (event.type === "phase" || event.type === "progress" || event.type === "done") {
      return;
    }

    if (event.type === "assistant_chunk") {
      setStreamingAssistantText((current) =>
        current.length === 0 ? event.text : `${current}\n${event.text}`,
      );

      return;
    }

    if (event.type === "question") {
      setStreamingAssistantText("");
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-question-${Date.now()}`,
          role: "assistant",
          content: event.question,
        },
      ]);
      setPhase("conversation");

      return;
    }

    if (event.type === "proposal_ready") {
      setStreamingAssistantText("");
      setProposal(event.proposal);
      setProposalId(event.proposalId);
      setPhase("proposal_ready");

      return;
    }

    if (event.type === "error") {
      setStreamingAssistantText("");
      setErrorMessage(event.message);
      setPhase("conversation");
    }
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text) {
      return;
    }

    setErrorMessage(null);
    setMessages((currentMessages) => [
      ...currentMessages,
      { id: `user-${Date.now()}`, role: "user", content: text },
    ]);
    setInputValue("");
    const previousProposalId = proposalId;
    setProposal(null);
    setProposalId(null);
    setStreamingAssistantText("");
    setPhase("planning");

    const sendResult = await ResultAsync.fromPromise(
      (async () => {
        const sessionId = await ensureSession();
        await client.appendMessage(sessionId, {
          role: "user",
          kind: "text",
          content: text,
        });
        const streamedTerminalEvent = { current: false };
        await client.planSessionStream(sessionId, {
          runtimeId,
          onEvent: (event) => {
            if (
              event.type === "question" ||
              event.type === "error" ||
              (event.type === "proposal_ready" && event.proposal.mode === "generate")
            ) {
              streamedTerminalEvent.current = true;
            }
            handleEvent(event);
          },
        });
        if (!streamedTerminalEvent.current) {
          const latestProposal = await client.getLatestReadyProposal(sessionId, "generate", {
            excludeProposalId: previousProposalId,
          });
          if (latestProposal && latestProposal.proposal.mode === "generate") {
            handleEvent({
              type: "proposal_ready",
              proposal: latestProposal.proposal,
              proposalId: latestProposal.proposalId,
            });

            return;
          }

          const latestQuestion = await client.getLatestAssistantQuestion(sessionId);
          if (latestQuestion) {
            handleEvent({
              type: "question",
              question: latestQuestion.question,
            });
          }
        }
      })(),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (sendResult.isErr()) {
      setStreamingAssistantText("");
      setErrorMessage(sendResult.error.message);
      setPhase("conversation");
    }
  };

  const handleApprove = async () => {
    if (!sessionIdRef.current || !proposalId) {
      return;
    }

    setErrorMessage(null);
    setPhase("generating");
    const generationResult = await ResultAsync.fromPromise(
      (async () => {
        const sessionId = sessionIdRef.current!;
        await client.approveProposal(sessionId, proposalId);
        const generated = await ResultAsync.fromPromise(
          client.generatePipelineFromApprovedProposal(sessionId),
          (error) => (error instanceof Error ? error : new Error(String(error))),
        );
        if (generated.isOk()) {
          return generated.value;
        }
        if (typeof (generated.error as Error & { status?: number }).status === "number") {
          throw generated.error;
        }

        const abortController = new AbortController();
        const polled = await ResultAsync.fromPromise(
          client.waitForCreatedPipeline(sessionId, {
            signal: abortController.signal,
          }),
          (error) => (error instanceof Error ? error : new Error(String(error))),
        );
        abortController.abort();
        if (polled.isOk()) {
          return polled.value;
        }

        throw generated.error;
      })(),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (generationResult.isErr()) {
      setErrorMessage(generationResult.error.message);
      setPhase("proposal_ready");

      return;
    }

    const materializationResult = await ResultAsync.fromPromise(
      materializePipeline(
        generationResult.value.pipelineId,
        sharedSidebarStore.getState().currentProjectId,
      ),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (materializationResult.isErr()) {
      setErrorMessage(materializationResult.error.message);
      setPhase("proposal_ready");

      return;
    }

    setCreatedPipelineId(materializationResult.value);
    setPhase("success");
  };

  const supersedeActiveProposal = async () => {
    if (!sessionIdRef.current || !proposalId) {
      return true;
    }

    const supersedeResult = await ResultAsync.fromPromise(
      client.supersedeProposal(sessionIdRef.current, proposalId),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (supersedeResult.isErr()) {
      setErrorMessage(supersedeResult.error.message);

      return false;
    }

    return true;
  };

  const handleRevise = async () => {
    setErrorMessage(null);
    const superseded = await supersedeActiveProposal();
    if (!superseded) {
      return;
    }

    setProposal(null);
    setProposalId(null);
    setPhase("conversation");
  };

  const handleReject = async () => {
    setErrorMessage(null);
    const superseded = await supersedeActiveProposal();
    if (!superseded) {
      return;
    }

    setProposal(null);
    setProposalId(null);
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `system-reject-${Date.now()}`,
        role: "system",
        content: t("newPipelineDialog.rejected"),
      },
    ]);
    setPhase("conversation");
  };

  const handleOpenInCanvas = () => {
    if (!createdPipelineId) {
      return;
    }

    handleClose?.();
    void router.navigate({ to: "/canvas", search: { id: createdPipelineId } });
  };

  const handleRunNow = async () => {
    if (!createdPipelineId) {
      return;
    }

    const runNowResult = await ResultAsync.fromPromise(
      dataProvider.custom!({
        url: "pipelines/run",
        method: "post",
        payload: { id: createdPipelineId },
      }),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (runNowResult.isErr()) {
      setErrorMessage(runNowResult.error.message);

      return;
    }

    handleClose?.();
    void router.navigate({ to: "/canvas", search: { id: createdPipelineId } });
  };

  const handleUploadClick = async () => {
    setErrorMessage(null);
    const sessionResult = await ResultAsync.fromPromise(ensureSession(), (error) =>
      error instanceof Error ? error : new Error(String(error)),
    );
    if (sessionResult.isErr()) {
      setErrorMessage(sessionResult.error.message);

      return;
    }

    fileInputRef.current?.click();
  };

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    event.target.value = "";

    setErrorMessage(null);
    setIsUploading(true);
    const uploadResult = await ResultAsync.fromPromise(
      (async () => {
        const sessionId = await ensureSession();

        return runtimeId
          ? client.uploadAttachment(sessionId, file, { runtimeId })
          : client.uploadAttachment(sessionId, file);
      })(),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    setIsUploading(false);
    if (uploadResult.isErr()) {
      setErrorMessage(uploadResult.error.message);

      return;
    }

    const attachment = uploadResult.value.attachment;
    if (attachment) {
      setAttachments((currentAttachments) => [
        ...currentAttachments,
        {
          id: attachment.id,
          filename: attachment.filename,
          parseError: attachment.parseError,
          parseStatus: attachment.parseStatus ?? "parsed",
        },
      ]);
    }
  };

  const handleAttachmentRemove = async (attachmentId: string) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || phase !== "conversation") {
      return;
    }

    setErrorMessage(null);
    setRemovingAttachmentId(attachmentId);
    const removeResult = await ResultAsync.fromPromise(
      client.removeAttachment(sessionId, attachmentId),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    setRemovingAttachmentId(null);
    if (removeResult.isErr()) {
      setErrorMessage(removeResult.error.message);

      return;
    }

    setAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.id !== attachmentId),
    );
  };

  const handleAttachmentRemoveClick = (event: MouseEvent<HTMLButtonElement>) => {
    const attachmentId = event.currentTarget.dataset.attachmentId;
    if (attachmentId) {
      void handleAttachmentRemove(attachmentId);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setInputValue(prompt);
  };

  const handleCreateAnotherButtonClick = () => {
    resetWorkspace();
  };

  if (phase === "success") {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-5 text-center",
          isHome ? "rounded-2xl border border-border bg-card px-6 py-10 shadow-sm" : "py-6",
        )}
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="size-7 text-success" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em]">
            {t("newPipelineDialog.pipelineReady")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("newPipelineDialog.pipelineCreatedDescription")}
          </p>
          <p className="pt-1 text-sm font-medium text-foreground">{displayName}</p>
          <Badge className="font-mono text-[11px]" variant="secondary">
            {createdPipelineId}
          </Badge>
        </div>
        {errorMessage && (
          <div className="flex w-full items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2 text-left text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={handleOpenInCanvas}>
            <ExternalLink className="size-4" />
            {t("newPipelineDialog.openInCanvas")}
          </Button>
          <Button className="flex-1" variant="secondary" onClick={handleRunNow}>
            <Play className="size-4" />
            {t("newPipelineDialog.runNow")}
          </Button>
        </div>
        <Button variant="ghost" onClick={handleCreateAnotherButtonClick}>
          <Plus className="size-4" />
          {t("newPipelineDialog.createAnother")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-col gap-3">
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {hasConversation && (
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
                "max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-6",
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
            <div className="max-w-[88%] whitespace-pre-wrap rounded-xl border border-dashed border-border bg-card px-3.5 py-2.5 text-sm leading-6 text-muted-foreground">
              {streamingAssistantText}
            </div>
          )}
          {attachments.length > 0 && (
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
                      disabled={phase !== "conversation" || removingAttachmentId === attachment.id}
                      size="icon-xs"
                      type="button"
                      variant="ghost"
                      onClick={handleAttachmentRemoveClick}
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
          )}
          {proposal?.mode === "generate" && (
            <div className="rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
              <div className="flex items-start gap-3">
                {isHome && (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <WandSparkles className="size-4" />
                  </span>
                )}
                <div className="min-w-0 space-y-3">
                  <div>
                    <p className="font-semibold text-foreground">{proposal.purpose}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t("home.proposalHint")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {proposal.inputs.map((input) => (
                      <Badge key={`input-${input}`} variant="outline">
                        {input}
                      </Badge>
                    ))}
                    {proposal.outputs.map((output) => (
                      <Badge key={`output-${output}`} variant="secondary">
                        {output}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {proposal.majorOperations.join(" · ")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        aria-label={t("newPipelineDialog.upload")}
        className="hidden"
        type="file"
        onChange={handleUploadChange}
      />

      <div
        className={cn(
          "border border-border bg-card shadow-sm transition-colors focus-within:border-foreground/25",
          isHome ? "rounded-2xl p-3" : "rounded-xl p-2.5",
        )}
      >
        <Textarea
          aria-label={t("newPipelineDialog.messagePlaceholder")}
          className={cn(
            "resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0",
            isHome ? "min-h-24 text-[15px] leading-6" : "min-h-20 text-sm",
          )}
          placeholder={t("newPipelineDialog.messagePlaceholder")}
          rows={isHome ? 4 : 3}
          value={inputValue}
          onChange={handleMessageInputChange}
          onKeyDown={handleInputKeyDown}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            aria-label={t("newPipelineDialog.upload")}
            className={cn("shrink-0", !isHome && "px-2.5")}
            disabled={isUploading || phase === "planning" || phase === "generating"}
            size={isHome ? "icon" : "sm"}
            type="button"
            variant="ghost"
            onClick={handleUploadClick}
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isHome ? (
              <Paperclip className="size-4" />
            ) : (
              <Upload className="size-4" />
            )}
            {!isHome && <span>{t("newPipelineDialog.upload")}</span>}
          </Button>

          {isHome && (
            <Link
              className="inline-flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              to="/local-agents"
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  runtimeConnected ? "bg-success" : "bg-muted-foreground/45",
                )}
              />
              <span className="truncate">{runtimeLabel ?? t("home.connectLocalAgent")}</span>
            </Link>
          )}

          <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">
            {t("home.sendHint")}
          </span>
          {!proposal && (
            <Button
              aria-label={t("newPipelineDialog.send")}
              className={cn("shrink-0", isHome && "rounded-full")}
              disabled={phase === "planning" || inputValue.trim().length === 0}
              size={isHome ? "icon" : "sm"}
              onClick={handleSend}
            >
              {phase === "planning" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isHome ? (
                <ArrowUp className="size-4" />
              ) : (
                t("newPipelineDialog.send")
              )}
            </Button>
          )}
        </div>
      </div>

      {proposal ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleReject}>
            {t("newPipelineDialog.reject")}
          </Button>
          <Button size="sm" variant="outline" onClick={handleRevise}>
            {t("newPipelineDialog.revise")}
          </Button>
          <Button
            disabled={phase === "generating" || !isProposalReadyForApproval}
            size="sm"
            onClick={handleApprove}
          >
            {phase === "generating" && <Loader2 className="size-4 animate-spin" />}
            {phase === "generating" ? t("common.generating") : t("newPipelineDialog.approve")}
          </Button>
        </div>
      ) : isHome && !hasConversation ? (
        <div className="divide-y divide-border/70">
          {[
            {
              icon: Workflow,
              label: t("home.suggestions.build"),
              description: t("home.suggestions.buildDescription"),
              prompt: t("home.suggestions.buildPrompt"),
            },
            {
              icon: Sparkles,
              label: t("home.suggestions.organize"),
              description: t("home.suggestions.organizeDescription"),
              prompt: t("home.suggestions.organizePrompt"),
            },
            {
              icon: WandSparkles,
              label: t("home.suggestions.distill"),
              description: t("home.suggestions.distillDescription"),
              prompt: t("home.suggestions.distillPrompt"),
            },
          ].map((suggestion) => {
            const Icon = suggestion.icon;

            return (
              <button
                key={suggestion.label}
                className="group flex w-full items-center gap-3 px-2 py-3 text-left text-sm transition-colors hover:bg-surface-2"
                type="button"
                onClick={() => handleSuggestionClick(suggestion.prompt)}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium text-foreground">{suggestion.label}</span>
                <span className="hidden truncate text-muted-foreground sm:inline">
                  {suggestion.description}
                </span>
                <ArrowUp className="ml-auto size-3.5 rotate-45 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      ) : null}

      {!isHome && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
        </div>
      )}
    </div>
  );
};
