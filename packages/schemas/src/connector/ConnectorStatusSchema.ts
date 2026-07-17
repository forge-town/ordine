import { z } from "zod/v4";

export const CONNECTOR_STATUS_ENUM = {
  CONNECTED: "connected",
  NEEDS_SETUP: "needs_setup",
  ERROR: "error",
} as const;
export const ConnectorStatusSchema = z.enum(CONNECTOR_STATUS_ENUM);
export type ConnectorStatus = z.infer<typeof ConnectorStatusSchema>;
