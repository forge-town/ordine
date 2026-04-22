import { z } from "zod/v4";

export const NODE_RUN_STATUS_ENUM = {
  IDLE: "idle",
  RUNNING: "running",
  PASS: "pass",
  FAIL: "fail",
} as const;

export const NodeRunStatusSchema = z.enum(NODE_RUN_STATUS_ENUM);
export type NodeRunStatus = z.infer<typeof NodeRunStatusSchema>;
