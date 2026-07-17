import { z } from "zod/v4";

export const ROUTINE_TRIGGER_TYPE_ENUM = {
  CRON: "cron",
  EVENT: "event",
} as const;
export const RoutineTriggerTypeSchema = z.enum(ROUTINE_TRIGGER_TYPE_ENUM);
export type RoutineTriggerType = z.infer<typeof RoutineTriggerTypeSchema>;
