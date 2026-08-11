import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { ResultAsync } from "neverthrow";
import { CheckCircle2, ExternalLink, Loader2, Play, Plus, AlertCircle, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/ui/dialog";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import { Badge } from "@repo/ui/badge";
import {
  pipelineAgentSessionsClient,
  type PipelineAgentPlanEvent,
} from "@/lib/pipelineAgentSessionsClient";
import { useSidebarStore } from "@/store/sidebarStore";
import { dataProvider } from "@/integrations/refine/dataProvider";
import { router } from "@/router";
import type { PipelineAgentProposal } from "@repo/schemas";
import { materializeGeneratedPipeline } from "@/lib/materializeGeneratedPipeline";
import { sidebarStore as sharedSidebarStore } from "@repo/views/store/sidebarStore";

interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface AttachmentItem {
  id: string;
  filename: string;
  parseStatus: string;
}

export interface NewPipelineDialogProps {
  client?: typeof pipelineAgentSessionsClient;
  materializePipeline?: typeof materializeGeneratedPipeline;
}

export const NewPipelineDialog = ({
  client = pipelineAgentSessionsClient,
  materializePipeline = materializeGeneratedPipeline,
}: NewPipelineDialogProps = {}) => {
  const { t } = useTranslation();
  const store = useSidebarStore();
  const open = useStore(store, (state) => state.newPipelineOpen);
  const handleNewPipelineDialogOpenChange = useStore(
    store,
    (state) => state.handleNewPipelineDialogOpenChange,
  );
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
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
  const welcomeMessage = t("newPipelineDialog.welcome");

  const displayName = useMemo(() => {
    if (proposal?.mode === "generate") {
      return proposal.purpose;
    }

    return createdPipelineId ?? t("pipelines.createNew");
  }, [createdPipelineId, proposal, t]);
  const isProposalReadyForApproval =
    proposal?.mode === "generate" && proposal.readiness === "ready_for_generation";

  useEffect(() => {
    if (!open) {
      sessionIdRef.current = null;
      setAttachments([]);
      setCreatedPipelineId(null);
      setErrorMessage(null);
      setInputValue("");
      setMessages([]);
      setPhase("conversation");
      setProposal(null);
      setProposalId(null);
      setStreamingAssistantText("");

      return;
    }

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
  }, [open, welcomeMessage]);

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
      setMessages((prev) => [
        ...prev,
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
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: text }]);
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
    setMessages((prev) => [
      ...prev,
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

    handleNewPipelineDialogOpenChange(false);
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

    handleNewPipelineDialogOpenChange(false);
    void router.navigate({ to: "/canvas", search: { id: createdPipelineId } });
  };

  const handleCreateAnother = () => {
    handleNewPipelineDialogOpenChange(false);
    handleNewPipelineDialogOpenChange(true);
  };

  const handleUploadClick = () => {
    void ensureSession().then(() => fileInputRef.current?.click());
  };

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    event.target.value = "";

    const sessionId = await ensureSession();
    const uploadResult = await ResultAsync.fromPromise(
      client.uploadAttachment(sessionId, file),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (uploadResult.isErr()) {
      setErrorMessage(uploadResult.error.message);

      return;
    }

    const attachment = uploadResult.value.attachment;
    if (attachment) {
      setAttachments((prev) => [
        ...prev,
        {
          id: attachment.id,
          filename: attachment.filename,
          parseStatus: attachment.parseStatus ?? "parsed",
        },
      ]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleNewPipelineDialogOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {phase === "success" && (
          <>
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="animate-in zoom-in-50 fade-in duration-300 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col items-center gap-2 text-center">
                <DialogTitle className="text-lg">
                  {t("newPipelineDialog.pipelineReady")}
                </DialogTitle>
                <DialogDescription>
                  {t("newPipelineDialog.pipelineCreatedDescription")}
                </DialogDescription>
                <Badge className="mt-1 font-mono text-xs" variant="secondary">
                  {createdPipelineId}
                </Badge>
                <p className="text-sm font-medium text-foreground">{displayName}</p>
              </div>
            </div>
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            <DialogFooter className="animate-in fade-in slide-in-from-bottom-1 duration-500 flex-col gap-2 sm:flex-col">
              <div className="flex w-full gap-2">
                <Button className="flex-1" onClick={handleOpenInCanvas}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t("newPipelineDialog.openInCanvas")}
                </Button>
                <Button className="flex-1" variant="secondary" onClick={handleRunNow}>
                  <Play className="mr-2 h-4 w-4" />
                  {t("newPipelineDialog.runNow")}
                </Button>
              </div>
              <Button className="w-full" variant="ghost" onClick={handleCreateAnother}>
                <Plus className="mr-2 h-4 w-4" />
                {t("newPipelineDialog.createAnother")}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase !== "success" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("nav.newPipeline")}</DialogTitle>
              <DialogDescription>{t("pipelines.newPipelineDescription")}</DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto space-y-4 py-2">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className="rounded-md border px-3 py-2 text-sm">
                    {message.content}
                  </div>
                ))}
                {streamingAssistantText && (
                  <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap">
                    {streamingAssistantText}
                  </div>
                )}
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <Badge key={attachment.id} variant="secondary">
                      {attachment.filename}
                    </Badge>
                  ))}
                </div>
              )}

              {proposal?.mode === "generate" && (
                <div className="space-y-2 rounded-md border px-3 py-3 text-sm">
                  <p className="font-medium">{proposal.purpose}</p>
                  <p>{proposal.inputs.join(", ")}</p>
                  <p>{proposal.outputs.join(", ")}</p>
                  <p>{proposal.majorOperations.join(", ")}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <input
                ref={fileInputRef}
                aria-label={t("newPipelineDialog.upload")}
                className="hidden"
                type="file"
                onChange={handleUploadChange}
              />

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleUploadClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  {t("newPipelineDialog.upload")}
                </Button>
              </div>

              <Textarea
                placeholder={t("newPipelineDialog.messagePlaceholder")}
                rows={4}
                value={inputValue}
                onChange={handleMessageInputChange}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleNewPipelineDialogOpenChange(false)}>
                {t("common.cancel")}
              </Button>

              {proposal ? (
                <>
                  <Button variant="outline" onClick={handleReject}>
                    {t("newPipelineDialog.reject")}
                  </Button>
                  <Button variant="outline" onClick={handleRevise}>
                    {t("newPipelineDialog.revise")}
                  </Button>
                  <Button
                    disabled={phase === "generating" || !isProposalReadyForApproval}
                    onClick={handleApprove}
                  >
                    {phase === "generating" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("common.generating")}
                      </>
                    ) : (
                      t("newPipelineDialog.approve")
                    )}
                  </Button>
                </>
              ) : (
                <Button disabled={phase === "planning"} onClick={handleSend}>
                  {phase === "planning" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("newPipelineDialog.analyzing")}
                    </>
                  ) : (
                    t("newPipelineDialog.send")
                  )}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
