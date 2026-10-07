import type { AgentRun, AgentRunUsage, AgentRuntime } from "@repo/schemas";

import { redactSensitiveText } from "../sanitizeAgentRunData/sanitizeAgentRunData.helper";
import type { TerminalAgentRunStatus, AgentRunsServiceBindings } from "../../contracts";

import { runtimeEvent } from "../runtimeEvent";

export const createFinishRunHelper =
  (
    serviceBindings: Pick<
      AgentRunsServiceBindings,
      "persistEvent" | "getPublicRun" | "getRunRecord"
    >,
  ) =>
  async ({
    runId,
    runtime,
    status,
    resultText,
    nativeSessionId,
    usage,
    errorCode,
    errorMessage,
  }: {
    runId: string;
    runtime: AgentRuntime;
    status: TerminalAgentRunStatus;
    resultText: string;
    nativeSessionId: string | null;
    usage: AgentRunUsage | null;
    errorCode: string | null;
    errorMessage: string | null;
  }): Promise<AgentRun> => {
    const now = new Date();
    await (0, serviceBindings.persistEvent)(
      runId,
      runtimeEvent(runtime, {
        type: "terminal",
        status,
        exitCode: null,
        signal: null,
        resultText,
        ...(nativeSessionId ? { sessionId: nativeSessionId } : {}),
      }),
      {
        status,
        resultText: redactSensitiveText(resultText),
        nativeSessionId,
        usage,
        errorCode,
        errorMessage: errorMessage ? redactSensitiveText(errorMessage) : null,
        lastActivityAt: now,
        finishedAt: now,
      },
    );

    return (0, serviceBindings.getPublicRun)(await (0, serviceBindings.getRunRecord)(runId));
  };
