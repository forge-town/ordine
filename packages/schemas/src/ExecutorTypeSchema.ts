import { z } from "zod/v4";

export const ExecutorTypeSchema = z.enum(["agent", "script", "rule-check"]);
export type ExecutorType = z.infer<typeof ExecutorTypeSchema>;
