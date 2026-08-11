import { type MutableRefObject, useEffect, useState } from "react";
import { ResultAsync } from "neverthrow";
import { sidebarStore as sharedSidebarStore } from "@repo/views/store/sidebarStore";
import type { materializeGeneratedPipeline } from "@/lib/materializeGeneratedPipeline";
import type {
  pipelineAgentSessionsClient,
  PipelineAgentSessionClientDetail,
} from "@/lib/pipelineAgentSessionsClient";

export const HOME_PIPELINE_AGENT_SESSION_KEY = "ordine.pipeline-agent.current-session-id";

interface UsePipelineCreationSessionRecoveryOptions {
  active: boolean;
  activeRequestRef: MutableRefObject<AbortController | null>;
  client: typeof pipelineAgentSessionsClient;
  isHome: boolean;
  materializePipeline: typeof materializeGeneratedPipeline;
  sessionIdRef: MutableRefObject<string | null>;
  onCompleted: (pipelineId: string) => void;
  onError: (error: Error) => void;
  onMissing: () => void;
  onSessionDetail: (session: PipelineAgentSessionClientDetail) => void;
}

const waitForPollingInterval = (signal: AbortSignal) =>
  new Promise<void>((resolvePromise) => {
    const handleAbort = () => {
      globalThis.clearTimeout(timeoutId);
      resolvePromise();
    };
    const timeoutId = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolvePromise();
    }, 750);
    signal.addEventListener("abort", handleAbort, { once: true });
  });

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

          await waitForPollingInterval(controller.signal);
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
        if (status === 404) {
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

    return () => controller.abort();
  }, [
    active,
    activeRequestRef,
    client,
    isHome,
    materializePipeline,
    onCompleted,
    onError,
    onMissing,
    onSessionDetail,
    sessionIdRef,
  ]);

  return isRestoring;
};
