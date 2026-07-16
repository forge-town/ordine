import { z } from "zod/v4";

const CRON_EXPR_REGEX =
  /^[-,*/0-9L?#W\s]+\s+[-,*/0-9L?#W\s]+\s+[-,*/0-9L?#W\s]+\s+[-,*/0-9L?#W\s]+\s+[-,*/0-9L?#W\s]+$/;

const isValidCronExpression = (value: string): boolean => CRON_EXPR_REGEX.test(value.trim());

interface RoutineScheduleShape {
  cronExpression?: string | null | undefined;
  enabled: boolean;
}

// Cron is the only trigger mechanism: an enabled routine must carry a valid
// 5-field cron expression, and any provided expression must be well-formed.
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

// Explicit optional shape (not routineBaseSchema.partial()): the enabled
// default must not fire on patches that do not touch the schedule.
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
    if (data.cronExpression !== undefined || data.enabled !== undefined) {
      validateRoutineSchedule(
        {
          cronExpression: data.cronExpression ?? null,
          enabled: data.enabled ?? true,
        },
        ctx,
      );
    }
  });
export type UpdateRoutineInput = z.infer<typeof UpdateRoutineSchema>;
