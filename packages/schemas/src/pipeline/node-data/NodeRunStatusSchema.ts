import { z } from "zod/v4";

export const NODE_RUN_STATUS_ENUM = {
  IDLE: "idle",
  QUEUED: "queued",
  RUNNING: "running",
  WAITING_FOR_USER: "waitingForUser",
  RETRYING: "retrying",
  DONE: "done",
  FAILED: "failed",
  SKIPPED: "skipped",
  CANCELLED: "cancelled",
} as const;
export const NodeRunStatusSchema = z.enum(NODE_RUN_STATUS_ENUM);
export type NodeRunStatus = z.infer<typeof NodeRunStatusSchema>;

/**
 * Legacy 4-state values persisted by older versions ("pass" / "fail").
 * Use `normalizeNodeRunStatus` (or `LenientNodeRunStatusSchema`) at every
 * read boundary so stored data keeps deserializing.
 */
const LEGACY_NODE_RUN_STATUS_MAP: Record<string, NodeRunStatus> = {
  pass: "done",
  fail: "failed",
};

export const normalizeNodeRunStatus = (value: string): NodeRunStatus => {
  const legacy = LEGACY_NODE_RUN_STATUS_MAP[value];
  if (legacy) return legacy;
  const parsed = NodeRunStatusSchema.safeParse(value);

  return parsed.success ? parsed.data : "idle";
};

export const LegacyNodeRunStatusSchema = z
  .enum(["idle", "running", "pass", "fail"])
  .transform(normalizeNodeRunStatus);

/** Accepts both current and legacy values, always outputs the 9-state enum. */
export const LenientNodeRunStatusSchema = z
  .string()
  .transform(normalizeNodeRunStatus)
  .pipe(NodeRunStatusSchema);
