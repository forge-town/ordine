import { z } from "zod/v4";
import { RoutineTriggerTypeSchema } from "./RoutineTriggerTypeSchema";

export const RoutineSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  name: z.string().min(1),
  triggerType: RoutineTriggerTypeSchema,
  cronExpression: z.string().nullable(),
  eventType: z.string().nullable(),
  eventConfig: z.record(z.string(), z.unknown()).nullable(),
  inputConfig: z.record(z.string(), z.unknown()).nullable(),
  enabled: z.boolean().default(true),
  lastRunAt: z.coerce.date().nullable(),
  nextRunAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Routine = z.infer<typeof RoutineSchema>;

export const CreateRoutineSchema = RoutineSchema.omit({
  id: true,
  lastRunAt: true,
  nextRunAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  cronExpression: z.string().nullable().optional(),
  eventType: z.string().nullable().optional(),
  eventConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  inputConfig: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type CreateRoutineInput = z.infer<typeof CreateRoutineSchema>;

export const UpdateRoutineSchema = CreateRoutineSchema.partial();
export type UpdateRoutineInput = z.infer<typeof UpdateRoutineSchema>;
