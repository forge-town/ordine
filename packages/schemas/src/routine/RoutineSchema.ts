import { z } from "zod/v4";
import { isValidCronExpression } from "@repo/utils/cron";

interface RoutineScheduleShape {
  cronExpression?: string | null | undefined;
  enabled: boolean;
}

// Cron is the only trigger mechanism. Validity is defined by the shared cron
// parser (@repo/utils): an expression is valid if and only if a next
// occurrence can be computed, so schema validation and the scheduler can
// never disagree. An enabled routine must carry a valid expression.
const validateRoutineSchedule = (data: RoutineScheduleShape, ctx: z.RefinementCtx) => {
  const cronExpression = data.cronExpression ?? null;

  if (cronExpression && !isValidCronExpression(cronExpression)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "cronExpression is not a valid 5-field cron expression",
      path: ["cronExpression"],
    });
  }

  if (data.enabled && (!cronExpression || cronExpression.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "enabled routine must have a valid cronExpression",
      path: ["enabled"],
    });
  }
};

const routineBaseSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  cronExpression: z.string().nullable(),
  inputConfig: z.record(z.string(), z.unknown()).nullable(),
  enabled: z.boolean().default(true),
});

export const RoutineSchema = z
  .object({
    id: z.string(),
    pipelineId: z.string(),
    ...routineBaseSchema.shape,
    lastRunAt: z.coerce.date().nullable(),
    nextRunAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .superRefine(validateRoutineSchedule);
export type Routine = z.infer<typeof RoutineSchema>;

export const CreateRoutineSchema = routineBaseSchema
  .extend({
    pipelineId: z.string(),
    description: z.string().nullable().optional(),
    cronExpression: z.string().nullable().optional(),
    inputConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .superRefine(validateRoutineSchedule);
export type CreateRoutineInput = z.infer<typeof CreateRoutineSchema>;

// Patch-level validation only guarantees that a provided cronExpression is
// well-formed. The enabled/cron cross-check needs the stored routine and
// lives in routinesService.update, so patches like { enabled: true } stay
// expressible when the stored routine already has a valid expression.
export const UpdateRoutineSchema = z
  .object({
    pipelineId: z.string().optional(),
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    cronExpression: z.string().nullable().optional(),
    inputConfig: z.record(z.string(), z.unknown()).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (typeof data.cronExpression === "string" && !isValidCronExpression(data.cronExpression)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cronExpression is not a valid 5-field cron expression",
        path: ["cronExpression"],
      });
    }
  });
export type UpdateRoutineInput = z.infer<typeof UpdateRoutineSchema>;
