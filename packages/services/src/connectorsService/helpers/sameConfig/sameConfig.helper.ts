import { type ConnectorConfig } from "@repo/schemas";

/** Full structural comparison; both sides come from the same jsonb column. */
export const sameConfig = (a: ConnectorConfig, b: ConnectorConfig): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
