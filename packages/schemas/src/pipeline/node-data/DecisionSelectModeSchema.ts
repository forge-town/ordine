import { z } from "zod/v4";

export const DECISION_SELECT_MODE_ENUM = {
  SINGLE: "single",
  MULTI: "multi",
} as const;
export const DecisionSelectModeSchema = z.enum(DECISION_SELECT_MODE_ENUM);
export type DecisionSelectMode = z.infer<typeof DecisionSelectModeSchema>;
