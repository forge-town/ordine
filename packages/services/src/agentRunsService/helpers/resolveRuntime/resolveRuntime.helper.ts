import type { RuntimeConfig, ResolvedRuntime, AgentRunsServiceBindings } from "../../contracts";

import { resolveRuntimeExecutable } from "../resolveRuntimeExecutable";

export const createResolveRuntimeHelper =
  (
    serviceBindings: Pick<
      AgentRunsServiceBindings,
      "scan" | "readExecutable" | "probeCapabilities"
    >,
  ) =>
  async (config: RuntimeConfig): Promise<ResolvedRuntime> => {
    if (config.connection.mode !== "local") {
      throw new Error(`Agent Run control currently requires a local runtime: ${config.id}`);
    }
    const detected = await (0, serviceBindings.scan)();
    const matched = detected.find((candidate) => candidate.type === config.type);

    return resolveRuntimeExecutable({
      runtime: config.type,
      configuredPath: config.connection.path,
      configuredVersion: config.connection.version,
      detectedPath: matched?.path,
      detectedVersion: matched?.version,
      readExecutable: serviceBindings.readExecutable,
      probeCapabilities: serviceBindings.probeCapabilities,
    });
  };
