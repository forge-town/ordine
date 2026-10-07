import { type ConnectorConfig } from "@repo/schemas";

export const stripHandshakeArtifacts = (config: ConnectorConfig): Record<string, unknown> => {
  const next = { ...(config as Record<string, unknown>) };
  delete next.tools;
  delete next.lastError;

  return next;
};
