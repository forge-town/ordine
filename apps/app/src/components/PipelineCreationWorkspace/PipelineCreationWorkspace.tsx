import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ResultAsync } from "neverthrow";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Play, Plus } from "lucide-react";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import type { PipelineAgentProposal } from "@repo/schemas";
import { sidebarStore as sharedSidebarStore } from "@repo/views/store/sidebarStore";
import { dataProvider } from "@/integrations/refine/dataProvider";
import { materializeGeneratedPipeline } from "@/lib/materializeGeneratedPipeline";
import { getPipelineAgentErrorMessage } from "@/lib/pipelineAgentErrorMessage";
import {
  pipelineAgentSessionsClient,
  type PipelineAgentPlanEvent,
  type PipelineAgentSessionClientDetail,
} from "@/lib/pipelineAgentSessionsClient";
import { router } from "@/router";
import {
  HOME_PIPELINE_AGENT_SESSION_KEY,
  usePipelineCreationSessionRecovery,
} from "./usePipelineCreationSessionRecovery";
import { type PipelineCreationAttachment } from "./PipelineCreationAttachments";
import { PipelineCreationMessages, type PipelineCreationMessage } from "./PipelineCreationMessages";
import { PipelineCreationComposer } from "./PipelineCreationComposer";

type WorkspacePresentation = "dialog" | "home";

export interface PipelineCreationWorkspaceProps {
  active: boolean;
  client?: typeof pipelineAgentSessionsClient;
  materializePipeline?: typeof materializeGeneratedPipeline;
  presentation?: WorkspacePresentation;
  runtimeConfigured?: boolean;
  runtimeId?: string;
  runtimeLabel?: string;
  onClose?: () => void;
}

export const PipelineCreationWorkspace = ({
  active,
  client = pipelineAgentSessionsClient,
  materializePipeline = materializeGeneratedPipeline,
  presentation = "dialog",
  runtimeConfigured = false,
  runtimeId,
  runtimeLabel,
  onClose: handleClose,
}: PipelineCreationWorkspaceProps) => {
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState<PipelineCreationAttachment[]>([]);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<string | null>(null);
  const [createdPipelineId, setCreatedPipelineId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<PipelineCreationMessage[]>([]);
  const [phase, setPhase] = useState<
    "conversation" | "planning" | "proposal_ready" | "generating" | "success"
  >("conversation");
  const [proposal, setProposal] = useState<PipelineAgentProposal | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [streamingAssistantText, setStreamingAssistantText] = useState("");
  const sessionIdRef = useRef<string | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const translationRef = useRef(t);
  translationRef.current = t;
  const isHome = presentation === "home";
  const welcomeMessage = t("newPipelineDialog.welcome");
  const handlePipelineAgentError = useCallback(
    (error: Error) => setErrorMessage(getPipelineAgentErrorMessage(error, translationRef.current)),
    [],
  );

  const rememberSessionId = useCallback(
    (sessionId: string | null) => {
      sessionIdRef.current = sessionId;
      if (!isHome || globalThis.window === undefined) {
        return;
      }

      if (sessionId) {
        globalThis.window.localStorage.setItem(HOME_PIPELINE_AGENT_SESSION_KEY, sessionId);
      } else {
        globalThis.window.localStorage.removeItem(HOME_PIPELINE_AGENT_SESSION_KEY);
      }
    },
    [isHome],
  );

  const resetWorkspace = useCallback(
    (forgetPersistedSession = true) => {
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
      sessionIdRef.current = null;
      if (isHome && forgetPersistedSession && globalThis.window !== undefined) {
        globalThis.window.localStorage.removeItem(HOME_PIPELINE_AGENT_SESSION_KEY);
      }
      setAttachments([]);
      setIsCancelling(false);
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
    },
    [isHome],
  );

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
      resetWorkspace(!isHome);

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

  const applySessionDetail = useCallback((session: PipelineAgentSessionClientDetail) => {
    setMessages(
      (session.messages ?? []).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
      })),
    );
    setAttachments(
      (session.attachments ?? []).map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        parseError: attachment.parseError,
        parseStatus: attachment.parseStatus ?? "pending",
      })),
    );

    const proposals = session.proposals ?? [];
    const latestProposal =
      proposals.find((candidate) => candidate.id === session.latestProposalId) ??
      [...proposals].reverse().find((candidate) => candidate.status !== "superseded") ??
      null;
    if (latestProposal?.proposal.mode === "generate") {
      setProposal(latestProposal.proposal);
      setProposalId(latestProposal.id);
    } else {
      setProposal(null);
      setProposalId(null);
    }

    setCreatedPipelineId(session.createdPipelineId ?? null);
    if (session.status === "completed" && session.createdPipelineId) {
      setPhase("success");
    } else if (session.status === "generating" || session.status === "approved") {
      setPhase("generating");
    } else if (session.status === "proposal_ready" && latestProposal) {
      setPhase("proposal_ready");
    } else if (session.status === "analyzing") {
      setPhase("planning");
    } else {
      setPhase("conversation");
    }
  }, []);

  const handleRestoredPipeline = useCallback((pipelineId: string) => {
    setCreatedPipelineId(pipelineId);
    setPhase("success");
  }, []);
  const handleRestoreError = useCallback(
    (error: Error) => {
      handlePipelineAgentError(error);
      setPhase("conversation");
    },
    [handlePipelineAgentError],
  );
  const handleMissingSession = useCallback(() => resetWorkspace(true), [resetWorkspace]);
  const isRestoring = usePipelineCreationSessionRecovery({
    active,
    activeRequestRef,
    client,
    isHome,
    materializePipeline,
    sessionIdRef,
    onCompleted: handleRestoredPipeline,
    onError: handleRestoreError,
    onMissing: handleMissingSession,
    onSessionDetail: applySessionDetail,
  });

  const handleMessageInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
  };

  const ensureSession = async (signal?: AbortSignal) => {
    if (sessionIdRef.current) {
      return sessionIdRef.current;
    }

    const session = await client.createSession(
      {
        entrypoint: "new-pipeline-dialog",
        mode: "generate",
      },
      { signal },
    );
    rememberSessionId(session.id);

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
      handlePipelineAgentError(
        Object.assign(new Error(event.message), event.code ? { code: event.code } : {}),
      );
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
    const controller = new AbortController();
    activeRequestRef.current?.abort();
    activeRequestRef.current = controller;

    const sendResult = await ResultAsync.fromPromise(
      (async () => {
        const sessionId = await ensureSession(controller.signal);
        await client.appendMessage(
          sessionId,
          {
            role: "user",
            kind: "text",
            content: text,
          },
          { signal: controller.signal },
        );
        const streamedTerminalEvent = { current: false };
        await client.planSessionStream(sessionId, {
          runtimeId,
          signal: controller.signal,
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
            signal: controller.signal,
          });
          if (latestProposal && latestProposal.proposal.mode === "generate") {
            handleEvent({
              type: "proposal_ready",
              proposal: latestProposal.proposal,
              proposalId: latestProposal.proposalId,
            });

            return;
          }

          const latestQuestion = await client.getLatestAssistantQuestion(sessionId, {
            signal: controller.signal,
          });
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
    if (activeRequestRef.current === controller) {
      activeRequestRef.current = null;
    }
    if (controller.signal.aborted) {
      return;
    }
    if (sendResult.isErr()) {
      setStreamingAssistantText("");
      handlePipelineAgentError(sendResult.error);
      setPhase("conversation");
    }
  };

  const handleApprove = async () => {
    if (!sessionIdRef.current || !proposalId) {
      return;
    }

    setErrorMessage(null);
    setPhase("generating");
    const controller = new AbortController();
    activeRequestRef.current?.abort();
    activeRequestRef.current = controller;
    const generationResult = await ResultAsync.fromPromise(
      (async () => {
        const sessionId = sessionIdRef.current!;
        await client.approveProposal(sessionId, proposalId, { signal: controller.signal });
        const generated = await ResultAsync.fromPromise(
          client.generatePipelineFromApprovedProposal(sessionId, { signal: controller.signal }),
          (error) => (error instanceof Error ? error : new Error(String(error))),
        );
        if (generated.isOk()) {
          return generated.value;
        }
        if (typeof (generated.error as Error & { status?: number }).status === "number") {
          throw generated.error;
        }

        const polled = await ResultAsync.fromPromise(
          client.waitForCreatedPipeline(sessionId, {
            signal: controller.signal,
          }),
          (error) => (error instanceof Error ? error : new Error(String(error))),
        );
        if (polled.isOk()) {
          return polled.value;
        }

        throw generated.error;
      })(),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (controller.signal.aborted) {
      return;
    }
    if (generationResult.isErr()) {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
      handlePipelineAgentError(generationResult.error);
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
    if (activeRequestRef.current === controller) {
      activeRequestRef.current = null;
    }
    if (controller.signal.aborted) {
      return;
    }
    if (materializationResult.isErr()) {
      handlePipelineAgentError(materializationResult.error);
      setPhase("proposal_ready");

      return;
    }

    setCreatedPipelineId(materializationResult.value);
    setPhase("success");
  };

  const handleCancel = async () => {
    const sessionId = sessionIdRef.current;
    const cancelledPhase = phase;
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setErrorMessage(null);
    if (!sessionId) {
      setPhase(cancelledPhase === "generating" ? "proposal_ready" : "conversation");

      return;
    }

    setIsCancelling(true);
    const cancelResult = await ResultAsync.fromPromise(client.cancelSession(sessionId), (error) =>
      error instanceof Error ? error : new Error(String(error)),
    );
    setIsCancelling(false);
    if (cancelResult.isErr()) {
      handlePipelineAgentError(cancelResult.error);

      return;
    }

    setStreamingAssistantText("");
    setPhase(cancelledPhase === "generating" ? "proposal_ready" : "conversation");
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
      handlePipelineAgentError(supersedeResult.error);

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

    rememberSessionId(null);
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
      handlePipelineAgentError(runNowResult.error);

      return;
    }

    rememberSessionId(null);
    handleClose?.();
    void router.navigate({ to: "/canvas", search: { id: createdPipelineId } });
  };

  const handleUploadClick = async () => {
    setErrorMessage(null);
    const sessionResult = await ResultAsync.fromPromise(ensureSession(), (error) =>
      error instanceof Error ? error : new Error(String(error)),
    );
    if (sessionResult.isErr()) {
      handlePipelineAgentError(sessionResult.error);

      return;
    }

    fileInputRef.current?.click();
  };

  const handleUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
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
      handlePipelineAgentError(uploadResult.error);

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
      handlePipelineAgentError(removeResult.error);

      return;
    }

    setAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.id !== attachmentId),
    );
  };

  const handleAttachmentRemoveRequest = (attachmentId: string) => {
    void handleAttachmentRemove(attachmentId);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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

  if (isRestoring) {
    return (
      <div className="flex min-h-48 w-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span>{t("newPipelineDialog.restoring")}</span>
      </div>
    );
  }

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
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">{errorMessage}</span>
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
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{errorMessage}</span>
        </div>
      )}

      {hasConversation && (
        <PipelineCreationMessages
          attachments={attachments}
          canRemoveAttachments={phase === "conversation"}
          isHome={isHome}
          messages={messages}
          proposal={proposal}
          removingAttachmentId={removingAttachmentId}
          streamingAssistantText={streamingAssistantText}
          onRemoveAttachment={handleAttachmentRemoveRequest}
        />
      )}

      <PipelineCreationComposer
        fileInputRef={fileInputRef}
        hasConversation={hasConversation}
        inputValue={inputValue}
        isCancelling={isCancelling}
        isHome={isHome}
        isProposalReadyForApproval={isProposalReadyForApproval}
        isUploading={isUploading}
        phase={phase}
        proposalVisible={proposal !== null}
        runtimeConfigured={runtimeConfigured}
        runtimeLabel={runtimeLabel}
        onApprove={handleApprove}
        onCancel={handleCancel}
        onClose={handleClose}
        onInputChange={handleMessageInputChange}
        onInputKeyDown={handleInputKeyDown}
        onReject={handleReject}
        onRevise={handleRevise}
        onSend={handleSend}
        onSuggestion={handleSuggestionClick}
        onUploadChange={handleUploadChange}
        onUploadClick={handleUploadClick}
      />
    </div>
  );
};
