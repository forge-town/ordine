import { useCallback, useMemo, useRef } from "react";
import { ResultAsync } from "neverthrow";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { ConversationMessageMetadata, PipelineActionProposal } from "@repo/schemas";
import { useCanvasPageStore } from "../_store";
import {
  createPipelineAgentSessionsClient,
  type PipelineAgentPlanEvent,
} from "../../../lib/pipelineAgentSessionsClient";
import { usePlatform } from "../../../platform";
import { useAgentBarStore, useAgentBarStoreApi } from "./_store";
import { HISTORY_WINDOW_LIMIT, useAgentContext } from "./context";
import {
  clearGenerateSessionId,
  loadGenerateSessionId,
  saveGenerateSessionId,
} from "./generateSessionStorage";
import { hasPendingPipelinePrompt } from "./pendingPipelinePrompt";
import {
  useAgentConversationPersistence,
  type SendAgentMessageInput,
} from "./useAgentConversationPersistence";

export type AgentConversationSubmitInput = {
  content: string;
  metadata?: ConversationMessageMetadata;
  runtimeId: string;
  model?: string;
  reasoningEffort?: string;
  speed?: string;
};

export const useAgentConversation = ({
  onGeneratedPipeline,
  pipelineId,
}: {
  onGeneratedPipeline?: (pipelineId: string) => Promise<void> | void;
  pipelineId: string | null;
}) => {
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
  const generateSession = useMemo(
    () => !pipelineId || Boolean(loadGenerateSessionId()) || hasPendingPipelinePrompt(),
    [pipelineId],
  );
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

    if (generateSession) {
      const persistedSessionId = loadGenerateSessionId();
      if (persistedSessionId) {
        const persistedSession = await ResultAsync.fromPromise(
          client.getSessionById(persistedSessionId),
          (error) => (error instanceof Error ? error : new Error(String(error))),
        );
        if (
          persistedSession.isOk() &&
          persistedSession.value.mode === "generate" &&
          !persistedSession.value.createdPipelineId &&
          persistedSession.value.status !== "failed" &&
          persistedSession.value.status !== "completed"
        ) {
          const restoredMessages = (persistedSession.value.messages ?? []).flatMap((message) =>
            message.role === "system"
              ? []
              : [
                  {
                    content: message.content,
                    id: message.id,
                    role: message.role,
                  },
                ],
          );
          agentBarStore.getState().setMessages(restoredMessages);
          agentBarStore.getState().setSession(persistedSessionId, graphSignature);

          const latestProposal =
            (persistedSession.value.proposals ?? []).find(
              (proposal) => proposal.id === persistedSession.value.latestProposalId,
            ) ?? persistedSession.value.proposals?.at(-1);
          if (
            latestProposal?.mode === "generate" &&
            latestProposal.proposal.mode === "generate" &&
            latestProposal.status === "proposal_ready"
          ) {
            agentBarStore.getState().setProposalId(latestProposal.id);
            agentBarStore.getState().setGenerateProposal(latestProposal.proposal);
          }

          return persistedSessionId;
        }

        clearGenerateSessionId();
      }
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
        // 空画布和从 Home 恢复的 generate 会话不绑定 pipeline,
        // 方案同意后由后端创建 pipeline 并回填 createdPipelineId。
        entrypoint: "canvas-agent-panel",
        mode: generateSession ? "generate" : "edit",
        ...(pipelineId ? { pipelineId } : {}),
        snapshot: { edges, nodes },
      });
      if (generateSession) {
        saveGenerateSessionId(session.id);
      }

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
  }, [agentBarStore, client, edges, generateSession, nodes, pipelineId]);

  // 有 pipelineId 时消息同时落 conversationMessages(可跨刷新恢复);
  // generate 会话在 pipeline 创建前没有可挂靠的 pipeline,只写本地 store,服务端由 session 持久化。
  const persistMessage = useCallback(
    async ({
      content,
      metadata,
      phase,
      role = "user",
    }: SendAgentMessageInput): Promise<boolean> => {
      if (pipelineId) {
        return Boolean(await sendMessage({ content, metadata, phase, role }));
      }

      agentBarStore.getState().addMessage({
        content,
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        metadata,
        phase,
        role,
      });

      return true;
    },
    [agentBarStore, pipelineId, sendMessage],
  );

  const finishWithAssistantMessage = useCallback(
    async (content: string) => {
      const state = agentBarStore.getState();
      state.setStreamingAssistantText("");
      state.setStreamingProgress(null);
      state.setConversationState("done");

      return persistMessage({ content, phase: "done", role: "assistant" });
    },
    [agentBarStore, persistMessage],
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

      if (event.type === "thinking") {
        state.setConversationState("thinking");
        state.setStreamingProgress(event.text || "Thinking");

        return null;
      }

      if (event.type === "tool") {
        state.setConversationState("thinking");
        state.setStreamingProgress(`${event.name ?? "Tool"}: ${event.status ?? event.phase}`);

        return null;
      }

      if (event.type === "diagnostic") {
        state.setStreamingProgress(`${event.code}: ${event.message}`);

        return null;
      }

      if (event.type === "retry") {
        state.setConversationState("thinking");
        state.setStreamingProgress(event.message ?? `Retry ${event.phase}`);

        return null;
      }

      if (event.type === "usage") {
        state.setStreamingProgress(
          `Usage · input ${event.inputTokens ?? "—"} · output ${event.outputTokens ?? "—"}`,
        );

        return null;
      }

      if (event.type === "terminal") {
        state.setStreamingProgress(`Run ${event.status}`);
        if (event.status !== "completed") state.setConversationState("done");

        return null;
      }

      if (event.type === "question") {
        return finishWithAssistantMessage(event.question);
      }

      if (event.type === "proposal_ready" && event.proposal.mode === "edit") {
        const proposal: PipelineActionProposal = {
          actions: event.proposal.actions,
          openQuestions: event.proposal.openQuestions,
          readiness: event.proposal.readiness,
          summary: event.proposal.summary,
        };
        state.setProposalId(event.proposalId);
        setPendingProposal(proposal, event.proposal.diagnosticsPreview);
        return finishWithAssistantMessage(event.proposal.summary);
      }

      if (event.type === "proposal_ready" && event.proposal.mode === "generate") {
        state.setProposalId(event.proposalId);
        state.setGenerateProposal(event.proposal);
        return finishWithAssistantMessage(event.proposal.purpose);
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
    async ({
      content,
      metadata,
      runtimeId,
      model,
      reasoningEffort,
      speed,
    }: AgentConversationSubmitInput) => {
      const trimmedContent = content.trim();
      if (
        isLoading ||
        trimmedContent.length === 0 ||
        conversationState === "thinking" ||
        conversationState === "streaming"
      ) {
        return false;
      }

      // 空画布和 Home 恢复的会话走 generate 模式
      const mode = generateSession ? "generate" : "edit";
      clearPendingProposal();
      const state = agentBarStore.getState();
      state.setGenerateProposal(null);
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
          const persisted = await persistMessage({
            content: trimmedContent,
            metadata,
            phase: "thinking",
            role: "user",
          });
          if (!persisted) {
            throw new Error(t("canvas.agentPanel.requestFailed"));
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
            ...(model ? { model } : {}),
            ...(reasoningEffort ? { reasoningEffort } : {}),
            ...(speed ? { speed } : {}),
            onEvent: (event) => {
              if (
                event.type === "question" ||
                event.type === "error" ||
                event.type === "proposal_ready"
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
            const persistedTerminal = await Promise.all(terminalPersistences);
            if (persistedTerminal.some((value) => !value)) {
              throw new Error(t("canvas.agentPanel.requestFailed"));
            }

            return !streamFailed;
          }

          const latestProposal = await client.getLatestReadyProposal(sessionId, mode, {
            excludeProposalId: previousProposalId,
          });
          if (latestProposal && latestProposal.proposal.mode === mode) {
            const persistedProposal = await handlePlanEvent({
              proposal: latestProposal.proposal,
              proposalId: latestProposal.proposalId,
              type: "proposal_ready",
            });
            if (!persistedProposal) {
              throw new Error(t("canvas.agentPanel.requestFailed"));
            }

            return true;
          }

          const latestQuestion = await client.getLatestAssistantQuestion(sessionId);
          if (latestQuestion) {
            const persistedQuestion = await handlePlanEvent({
              question: latestQuestion.question,
              type: "question",
            });
            if (!persistedQuestion) {
              throw new Error(t("canvas.agentPanel.requestFailed"));
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
      generateSession,
      pipelineId,
      persistMessage,
      t,
    ],
  );

  const applyProposal = useCallback(
    async (runtimeId?: string | null) => {
      const proposal = agentPanel.pendingProposal;
      const state = agentBarStore.getState();
      const { generateProposal, proposalId, sessionId } = state;
      const hasBlockingDiagnostics =
        agentPanel.diagnostics?.some((diagnostic) => diagnostic.severity === "error") ?? false;
      if ((!proposal && !generateProposal) || hasBlockingDiagnostics) {
        return false;
      }

      if (generateProposal) {
        if (!sessionId || !proposalId) {
          return false;
        }
        state.setConversationState("thinking");
        const generation = await ResultAsync.fromPromise(
          (async () => {
            await client.approveProposal(sessionId, proposalId);

            const generated = await ResultAsync.fromPromise(
              client.generatePipelineFromApprovedProposal(sessionId, {
                runtimeId: runtimeId ?? undefined,
              }),
              (error) => (error instanceof Error ? error : new Error(String(error))),
            );
            if (generated.isOk()) {
              return generated.value;
            }

            const status = (generated.error as Error & { status?: number }).status;
            if (typeof status === "number") {
              throw generated.error;
            }

            return client.waitForCreatedPipeline(sessionId);
          })(),
          (error) => (error instanceof Error ? error : new Error(String(error))),
        );
        if (generation.isErr()) {
          await finishWithAssistantMessage(generation.error.message);

          return false;
        }

        clearGenerateSessionId();
        state.setGenerateProposal(null);
        state.setConversationState("done");
        await onGeneratedPipeline?.(generation.value.pipelineId);

        return true;
      }

      const approval = await ResultAsync.fromPromise(
        sessionId && proposalId ? client.approveProposal(sessionId, proposalId) : Promise.resolve(),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      );
      if (approval.isErr()) {
        await finishWithAssistantMessage(approval.error.message);

        return false;
      }

      if (!proposal || !applyAgentProposal(proposal)) {
        return false;
      }

      await persistMessage({
        content: t("canvas.agentPanel.applied"),
        phase: "done",
        role: "assistant",
      });
      agentBarStore.getState().resetSession();

      return true;
    },
    [
      agentBarStore,
      agentPanel,
      applyAgentProposal,
      client,
      finishWithAssistantMessage,
      onGeneratedPipeline,
      persistMessage,
      t,
    ],
  );

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
    agentBarStore.getState().setGenerateProposal(null);
    agentBarStore.getState().setProposalId(null);
    await persistMessage({
      content: t("canvas.agentPanel.discarded"),
      phase: "done",
      role: "assistant",
    });

    return true;
  }, [agentBarStore, clearPendingProposal, client, finishWithAssistantMessage, persistMessage, t]);

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
