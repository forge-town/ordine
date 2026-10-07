import type { AgentControlToolResult, AgentResourceRef } from "@repo/schemas";

import type { DomainError, AgentControlServiceBindings } from "../../contracts";

import { failureResult } from "../failureResult";

export const createPersistFailureHelper =
  (serviceBindings: Pick<AgentControlServiceBindings, "actionsDao" | "emit">) =>
  async ({
    actionId,
    toolName,
    runId,
    error,
    resources: targetResources = [],
  }: {
    actionId: string;
    toolName: string;
    runId: string | null;
    error: DomainError;
    resources?: AgentResourceRef[];
  }): Promise<AgentControlToolResult> => {
    const result = failureResult({ actionId, error, resources: targetResources });
    await serviceBindings.actionsDao.update(actionId, {
      status: "failed",
      result,
      completedAt: new Date(),
    });
    await (0, serviceBindings.emit)(runId, {
      type: "action_failed",
      actionId,
      toolName,
      error: result.retry!,
    });

    return result;
  };
