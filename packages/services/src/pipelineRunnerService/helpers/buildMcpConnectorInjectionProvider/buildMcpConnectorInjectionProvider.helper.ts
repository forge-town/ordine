import type { AgentRuntime } from "@repo/schemas";

import { buildMcpConnectorInjection } from "../../../connectorsService";
import { hydrateConnectorCredentials } from "../../../capabilityHarvestService";

import type { PipelineRunnerServiceBindings } from "../../contracts";
export const createBuildMcpConnectorInjectionProviderHelper =
  (serviceBindings: Pick<PipelineRunnerServiceBindings, "connectorsDao" | "options">) =>
  (preferredSource: AgentRuntime) => {
    return async (
      selectedToolNames: readonly string[],
      operationAgent: AgentRuntime = preferredSource,
    ) => {
      const connectors = await serviceBindings.connectorsDao.findMany();
      const hydratedConnectors = connectors.map((connector) => {
        if (connector.method !== "mcp" || connector.status !== "connected") return connector;
        const hydrated = hydrateConnectorCredentials(connector, {
          ...(serviceBindings.options.encryptionSecret === undefined
            ? {}
            : { encryptionSecret: serviceBindings.options.encryptionSecret }),
          ...(serviceBindings.options.env ? { env: serviceBindings.options.env } : {}),
          preferredSource: operationAgent,
        });
        if (hydrated.isErr()) throw hydrated.error;

        return { ...connector, config: hydrated.value };
      });

      return buildMcpConnectorInjection(hydratedConnectors, selectedToolNames);
    };
  };
