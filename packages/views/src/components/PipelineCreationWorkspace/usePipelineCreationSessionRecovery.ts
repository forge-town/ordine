import { type MutableRefObject, useEffect, useState } from "react";
import { ResultAsync } from "neverthrow";
import { sidebarStore as sharedSidebarStore } from "../../store/sidebarStore";
import type { MaterializeGeneratedPipeline } from "../../lib/materializeGeneratedPipeline";
import type {
  PipelineAgentPlanEvent,
  PipelineAgentSessionClientDetail,
  PipelineAgentSessionsClient,
} from "../../lib/pipelineAgentSessionsClient";

export const HOME_PIPELINE_AGENT_SESSION_KEY = "ordine.pipeline-agent.current-session-id";

interface UsePipelineCreationSessionRecoveryOptions {
  active: boolean;
  activeRequestRef: MutableRefObject<AbortController | null>;
  client: PipelineAgentSessionsClient;
  isHome: boolean;
  materializePipeline: MaterializeGeneratedPipeline;
  sessionIdRef: MutableRefObject<string | null>;
  onCompleted: (pipelineId: string) => void;
  onError: (error: Error) => void;
  onMissing: () => void;
  onSessionDetail: (session: PipelineAgentSessionClientDetail) => void;
  onPlanEvent: (event: PipelineAgentPlanEvent) => void;
}

export const usePipelineCreationSessionRecovery = ({
  active,
  activeRequestRef,
  client,
  isHome,
  materializePipeline,
  sessionIdRef,
  onCompleted,
  onError,
  onMissing,
  onSessionDetail,
  onPlanEvent,
}: UsePipelineCreationSessionRecoveryOptions) => {
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (!active || !isHome || globalThis.window === undefined) {
      return;
    }

    const savedSessionId = globalThis.window.localStorage.getItem(HOME_PIPELINE_AGENT_SESSION_KEY);
    if (!savedSessionId || sessionIdRef.current === savedSessionId) {
      return;
    }

    const controller = new AbortController();
    activeRequestRef.current = controller;
    sessionIdRef.current = savedSessionId;
    setIsRestoring(true);

    const restoreResult = ResultAsync.fromPromise(
      (async () => {
        const waitForPlanningToSettle = async (
          currentSession: PipelineAgentSessionClientDetail,
        ): Promise<PipelineAgentSessionClientDetail> => {
          if (currentSession.status !== "analyzing") {
            return currentSession;
          }
          await client.planSessionStream(savedSessionId, {
            signal: controller.signal,
            onEvent: onPlanEvent,
          });
          if (controller.signal.aborted) {
            throw new DOMException("The operation was aborted", "AbortError");
          }
          const nextSession = await client.getSessionById(savedSessionId, {
            signal: controller.signal,
          });

          return waitForPlanningToSettle(nextSession);
        };
        const initialSession = await client.getSessionById(savedSessionId, {
          signal: controller.signal,
        });
        const session = await waitForPlanningToSettle(initialSession);

        if (session.status === "failed") {
          throw Object.assign(new Error("Pipeline Agent session ended in a failed state"), {
            code: "PIPELINE_AGENT_SESSION_TERMINAL",
          });
        }

        onSessionDetail(session);
        const generatedPipeline =
          session.status === "approved"
            ? await client.generatePipelineFromApprovedProposal(savedSessionId, {
                signal: controller.signal,
              })
            : session.status === "generating"
              ? await client.waitForCreatedPipeline(savedSessionId, {
                  signal: controller.signal,
                })
              : null;
        const generatedPipelineId =
          generatedPipeline?.pipelineId ?? session.createdPipelineId ?? null;

        if (generatedPipelineId) {
          const localPipelineId = await materializePipeline(
            generatedPipelineId,
            sharedSidebarStore.getState().currentProjectId,
          );
          if (controller.signal.aborted) {
            throw new DOMException("The operation was aborted", "AbortError");
          }
          onCompleted(localPipelineId);
        }
      })(),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );

    void (async () => {
      const result = await restoreResult;
      if (controller.signal.aborted) {
        return;
      }
      if (result.isErr()) {
        const status = (result.error as Error & { status?: number }).status;
        const code = (result.error as Error & { code?: string }).code;
        if (status === 404 || code === "PIPELINE_AGENT_SESSION_TERMINAL") {
          onMissing();
        } else {
          onError(result.error);
        }
      }
      setIsRestoring(false);
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
    })();

    return () => {
      controller.abort();
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        sessionIdRef.current = null;
      }
    };
  }, [
    active,
    activeRequestRef,
    client,
    isHome,
    materializePipeline,
    onCompleted,
    onError,
    onMissing,
    onPlanEvent,
    onSessionDetail,
    sessionIdRef,
  ]);

  return isRestoring;
};
