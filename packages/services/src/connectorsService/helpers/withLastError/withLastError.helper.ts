import { type ConnectorConfig } from "@repo/schemas";

export const withLastError = (
  config: ConnectorConfig,
  lastError: string,
): Record<string, unknown> => ({
  ...(config as Record<string, unknown>),
  lastError,
});
