import { runtimeEvent } from "../../helpers/runtimeEvent";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createRecoverInterruptedRunsMethod = (
  serviceBindings: Pick<AgentRunsServiceBindings, "runsDao" | "persistEvent">,
) =>
  ({
    async recoverInterruptedRuns(): Promise<{ count: number; runIds: string[] }> {
      const unfinished = await serviceBindings.runsDao.findManyRecoverable(new Date());
      for (const run of unfinished) {
        await (0, serviceBindings.persistEvent)(
          run.id,
          runtimeEvent(run.runtime, {
            type: "diagnostic",
            level: "error",
            code: "SERVER_RESTART_INTERRUPTED",
            message: "The ORDINE service restarted while this run was active",
            retryable: true,
          }),
        );
        const now = new Date();
        await (0, serviceBindings.persistEvent)(
          run.id,
          runtimeEvent(run.runtime, {
            type: "terminal",
            status: "interrupted",
            exitCode: null,
            signal: null,
            resultText: run.resultText ?? "",
            ...(run.nativeSessionId ? { sessionId: run.nativeSessionId } : {}),
          }),
          {
            status: "interrupted",
            errorCode: "SERVER_RESTART_INTERRUPTED",
            errorMessage: "The ORDINE service restarted while this run was active",
            lastActivityAt: now,
            finishedAt: now,
          },
        );
      }

      return { count: unfinished.length, runIds: unfinished.map((run) => run.id) };
    },
  }).recoverInterruptedRuns;
