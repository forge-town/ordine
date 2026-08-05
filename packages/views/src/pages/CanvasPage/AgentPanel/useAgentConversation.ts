import { useCallback, useMemo, useRef } from "react";
import { ResultAsync } from "neverthrow";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { PipelineActionProposal } from "@repo/schemas";
import { useCanvasPageStore } from "../_store";
import {
  createPipelineAgentSessionsClient,
  type PipelineAgentPlanEvent,
} from "../../../lib/pipelineAgentSessionsClient";
import { usePlatform } from "../../../platform";
import { useAgentBarStore, useAgentBarStoreApi } from "./_store";
import { HISTORY_WINDOW_LIMIT, useAgentContext } from "./context";
import { useAgentConversationPersistence } from "./useAgentConversationPersistence";

export type AgentConversationSubmitInput = {
  content: string;
  runtimeId: string;
};

export const useAgentConversation = ({ pipelineId }: { pipelineId: string | null }) => {
  const { t } = useTranslation();
  const platform = usePlatform();
  const client = useMemo(() => createPipelineAgentSessionsClient(platform), [platform]);
  const canvasStore = useCanvasPageStore();
  const agentBarStore = useAgentBarStoreApi();
  const agentContext = useAgentContext();
  const agentPanel = useStore(canvasStore, (state) => state.agentPanel);
  const applyAgentProposal = useStore(canvasStore, (state) => state.applyAgentProposal);
  const clearPendingProposal = useStore(canvasStore, (state) => state.clearPendingProposal);
  const edges = useStore(canvasStore, (state) => state.edges);
  const nodes = useStore(canvasStore, (state) => state.nodes);
  const setPendingProposal = useStore(canvasStore, (state) => state.setPendingProposal);
  const conversationState = useAgentBarStore((state) => state.conversationState);
  const messages = useAgentBarStore((state) => state.messages);
  const streamingAssistantText = useAgentBarStore((state) => state.streamingAssistantText);
  const streamingProgress = useAgentBarStore((state) => state.streamingProgress);
  const sessionCreationRef = useRef<{
    graphSignature: string;
    promise: Promise<string>;
  } | null>(null);
  const {
    isLoading,
    isSending: isPersisting,
    sendMessage,
  } = useAgentConversationPersistence({
    phase: conversationState,
    pipelineId,
  });

  const ensureSession = useCallback(async () => {
    const graphSignature = JSON.stringify({ edges, nodes, pipelineId });
    const existingSessionId = () => {
      const current = agentBarStore.getState();

      return current.sessionGraphSignature === graphSignature ? current.sessionId : null;
    };
    const existing = existingSessionId();
    if (existing) {
      return existing;
    }

    while (sessionCreationRef.current) {
      const pending = sessionCreationRef.current;
      if (pending.graphSignature === graphSignature) {
        return pending.promise;
      }

      try {
        await pending.promise;
      } catch {
        // A failed creation for an obsolete graph must not prevent a retry for this graph.
      }

      const sessionId = existingSessionId();
      if (sessionId) {
        return sessionId;
      }
    }

    let creationPromise: Promise<string>;
    creationPromise = (async () => {
      const currentSessionId = existingSessionId();
      if (currentSessionId) {
        return currentSessionId;
      }

      const session = await client.createSession({
        entrypoint: "canvas-agent-panel",
        mode: "edit",
        ...(pipelineId ? { pipelineId } : {}),
        snapshot: { edges, nodes },
      });

      const history = agentBarStore.getState().messages.slice(-HISTORY_WINDOW_LIMIT);
      for (const message of history) {
        await client.appendMessage(session.id, {
          content: message.content,
          kind: "text",
          role: message.role,
        });
      }

      agentBarStore.getState().setSession(session.id, graphSignature);

      return session.id;
    })().finally(() => {
      if (sessionCreationRef.current?.promise === creationPromise) {
        sessionCreationRef.current = null;
      }
    });
    sessionCreationRef.current = { graphSignature, promise: creationPromise };

    return creationPromise;
  }, [agentBarStore, client, edges, nodes, pipelineId]);

  const finishWithAssistantMessage = useCallback(
    async (content: string) => {
      const state = agentBarStore.getState();
      state.setStreamingAssistantText("");
      state.setStreamingProgress(null);
      state.setConversationState("done");

      return Boolean(await sendMessage({ content, phase: "done", role: "assistant" }));
    },
    [agentBarStore, sendMessage],
  );

  const handlePlanEvent = useCallback(
    (event: PipelineAgentPlanEvent): Promise<boolean> | null => {
      const state = agentBarStore.getState();

      if (event.type === "phase") {
        state.setConversationState("thinking");
        state.setStreamingProgress(event.phase);

        return null;
      }

      if (event.type === "progress") {
        state.setConversationState("thinking");
        state.setStreamingProgress(event.message);

        return null;
      }

      if (event.type === "assistant_chunk") {
        state.setConversationState("streaming");
        state.appendStreamingAssistantText(event.text);

        return null;
      }

      if (event.type === "question") {
        return finishWithAssistantMessage(event.question);
      }

      if (event.type === "proposal_ready" && event.proposal.mode === "edit") {
        const proposal: PipelineActionProposal = {
          actions: event.proposal.actions,
          summary: event.proposal.summary,
        };
        state.setProposalId(event.proposalId);
        setPendingProposal(proposal, event.proposal.diagnosticsPreview);
        return finishWithAssistantMessage(event.proposal.summary);
      }

      if (event.type === "error") {
        return finishWithAssistantMessage(event.message);
      }

      if (event.type === "done") {
        state.setStreamingProgress(null);
        state.setConversationState("done");
      }

      return null;
    },
    [agentBarStore, finishWithAssistantMessage, setPendingProposal],
  );

  const submitMessage = useCallback(
    async ({ content, runtimeId }: AgentConversationSubmitInput) => {
      const trimmedContent = content.trim();
      if (
        !pipelineId ||
        isLoading ||
        trimmedContent.length === 0 ||
        conversationState === "thinking" ||
        conversationState === "streaming"
      ) {
        return false;
      }

      clearPendingProposal();
      const state = agentBarStore.getState();
      state.setConversationState("thinking");
      state.setStreamingAssistantText("");
      state.setStreamingProgress(null);

      const result = await ResultAsync.fromPromise(
        (async () => {
          const sessionId = await ensureSession();
          await client.appendMessage(sessionId, {
            content: JSON.stringify({ context: agentContext, type: "agent_context" }),
            kind: "text",
            role: "system",
          });
          const persistedMessage = await sendMessage({
            content: trimmedContent,
            phase: "thinking",
            role: "user",
          });
          if (!persistedMessage) {
            throw new Error(t("canvas.agentPanel.error"));
          }
          await client.appendMessage(sessionId, {
            content: trimmedContent,
            kind: "text",
            role: "user",
          });

          const previousProposalId = state.proposalId;
          const streamedTerminalEvent = { current: false };
          const terminalPersistences: Promise<boolean>[] = [];
          let streamFailed = false;
          await client.planSessionStream(sessionId, {
            runtimeId,
            onEvent: (event) => {
              if (
                event.type === "question" ||
                event.type === "error" ||
                (event.type === "proposal_ready" && event.proposal.mode === "edit")
              ) {
                streamedTerminalEvent.current = true;
              }
              if (event.type === "error") {
                streamFailed = true;
              }
              const persistence = handlePlanEvent(event);
              if (persistence) {
                terminalPersistences.push(persistence);
              }
            },
          });

          if (streamedTerminalEvent.current) {
            const persisted = await Promise.all(terminalPersistences);
            if (persisted.some((value) => !value)) {
              throw new Error(t("canvas.agentPanel.error"));
            }

            return !streamFailed;
          }

          const latestProposal = await client.getLatestReadyProposal(sessionId, "edit", {
            excludeProposalId: previousProposalId,
          });
          if (latestProposal && latestProposal.proposal.mode === "edit") {
            const persisted = await handlePlanEvent({
              proposal: latestProposal.proposal,
              proposalId: latestProposal.proposalId,
              type: "proposal_ready",
            });
            if (!persisted) {
              throw new Error(t("canvas.agentPanel.error"));
            }

            return true;
          }

          const latestQuestion = await client.getLatestAssistantQuestion(sessionId);
          if (latestQuestion) {
            const persisted = await handlePlanEvent({
              question: latestQuestion.question,
              type: "question",
            });
            if (!persisted) {
              throw new Error(t("canvas.agentPanel.error"));
            }
          }

          return true;
        })(),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      );

      if (result.isErr()) {
        const persisted = await finishWithAssistantMessage(result.error.message);
        if (!persisted) {
          agentBarStore.getState().addMessage({
            content: result.error.message,
            id: `assistant-error-${Date.now()}`,
            phase: "done",
            role: "assistant",
          });
        }

        return false;
      }

      if (!result.value) {
        return false;
      }

      if (agentBarStore.getState().conversationState !== "done") {
        agentBarStore.getState().setConversationState("done");
      }

      return true;
    },
    [
      agentBarStore,
      agentContext,
      clearPendingProposal,
      client,
      conversationState,
      ensureSession,
      finishWithAssistantMessage,
      handlePlanEvent,
      isLoading,
      pipelineId,
      sendMessage,
      t,
    ],
  );

  const applyProposal = useCallback(async () => {
    const proposal = agentPanel.pendingProposal;
    const hasBlockingDiagnostics =
      agentPanel.diagnostics?.some((diagnostic) => diagnostic.severity === "error") ?? false;
    if (!proposal || hasBlockingDiagnostics) {
      return false;
    }

    const { proposalId, sessionId } = agentBarStore.getState();
    const approval = await ResultAsync.fromPromise(
      sessionId && proposalId ? client.approveProposal(sessionId, proposalId) : Promise.resolve(),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (approval.isErr()) {
      await finishWithAssistantMessage(approval.error.message);

      return false;
    }

    if (!applyAgentProposal(proposal)) {
      return false;
    }

    await sendMessage({
      content: t("canvas.agentPanel.applied"),
      phase: "done",
      role: "assistant",
    });
    agentBarStore.getState().resetSession();

    return true;
  }, [
    agentBarStore,
    agentPanel,
    applyAgentProposal,
    client,
    finishWithAssistantMessage,
    sendMessage,
    t,
  ]);

  const discardProposal = useCallback(async () => {
    const { proposalId, sessionId } = agentBarStore.getState();
    const superseded = await ResultAsync.fromPromise(
      sessionId && proposalId ? client.supersedeProposal(sessionId, proposalId) : Promise.resolve(),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (superseded.isErr()) {
      await finishWithAssistantMessage(superseded.error.message);

      return false;
    }

    clearPendingProposal();
    agentBarStore.getState().setProposalId(null);
    await sendMessage({
      content: t("canvas.agentPanel.discarded"),
      phase: "done",
      role: "assistant",
    });

    return true;
  }, [agentBarStore, clearPendingProposal, client, finishWithAssistantMessage, sendMessage, t]);

  return {
    agentContext,
    applyProposal,
    conversationState,
    discardProposal,
    ensureSession,
    isLoading,
    isSending:
      isPersisting || conversationState === "thinking" || conversationState === "streaming",
    messages,
    resetSession: agentBarStore.getState().resetSession,
    streamingAssistantText,
    streamingProgress,
    submitMessage,
  };
};
