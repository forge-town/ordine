import { parseLocalAgentRuntimeId } from "@repo/schemas";

import type { RuntimeConfig, AgentRunsServiceBindings } from "../../contracts";

export const createResolveRuntimeConfigHelper =
  (serviceBindings: Pick<AgentRunsServiceBindings, "runtimesDao">) =>
  async (runtimeConfigId: string): Promise<RuntimeConfig> => {
    const stored = await serviceBindings.runtimesDao.findById(runtimeConfigId);
    if (stored) return stored;
    const localRuntime = parseLocalAgentRuntimeId(runtimeConfigId);
    if (!localRuntime) throw new Error(`Agent runtime config not found: ${runtimeConfigId}`);

    return {
      id: runtimeConfigId,
      name: localRuntime,
      type: localRuntime,
      connection: { mode: "local" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  };
