import { z } from "zod/v4";
import { RoutineTriggerTypeSchema } from "./RoutineTriggerTypeSchema";

const CRON_EXPR_REGEX = /^[-,*/0-9L?#W\s]+\s+[-,*/0-9L?#W\s]+\s+[-,*/0-9L?#W\s]+\s+[-,*/0-9L?#W\s]+\s+[-,*/0-9L?#W\s]+$/;

const isValidCronExpression = (value: string): boolean => CRON_EXPR_REGEX.test(value.trim());

interface RoutineTriggerShape {
  triggerType: "cron" | "event";
  cronExpression?: string | null | undefined;
  eventType?: string | null | undefined;
  eventConfig?: Record<string, unknown> | null | undefined;
  inputConfig?: Record<string, unknown> | null | undefined;
  enabled: boolean;
}

const validateRoutineTrigger = (data: RoutineTriggerShape, ctx: z.RefinementCtx) => {
  const cronExpression = data.cronExpression ?? null;
  const eventType = data.eventType ?? null;

  if (data.triggerType === "cron") {
    if (!cronExpression || cronExpression.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cronExpression is required when triggerType is cron",
        path: ["cronExpression"],
      });
    } else if (!isValidCronExpression(cronExpression)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cronExpression is not a valid 5-field cron expression",
        path: ["cronExpression"],
      });
    }
    if (eventType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "eventType must be null when triggerType is cron",
        path: ["eventType"],
      });
    }
  }

  if (data.triggerType === "event") {
    if (!eventType || eventType.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "eventType is required when triggerType is event",
        path: ["eventType"],
      });
    }
    if (cronExpression) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cronExpression must be null when triggerType is event",
        path: ["cronExpression"],
      });
    }
  }

  if (data.enabled && data.triggerType === "cron" && (!cronExpression || cronExpression.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "enabled cron routine must have a valid cronExpression",
      path: ["enabled"],
    });
  }
};

const routineTriggerFields = {
  triggerType: RoutineTriggerTypeSchema,
  cronExpression: z.string().nullable(),
  eventType: z.string().nullable(),
  eventConfig: z.record(z.string(), z.unknown()).nullable(),
  inputConfig: z.record(z.string(), z.unknown()).nullable(),
  enabled: z.boolean().default(true),
};

const routineBaseSchema = z.object({
  name: z.string().min(1),
  ...routineTriggerFields,
});

export const RoutineSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  ...routineBaseSchema.shape,
  lastRunAt: z.coerce.date().nullable(),
  nextRunAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).superRefine(validateRoutineTrigger);
export type Routine = z.infer<typeof RoutineSchema>;

export const CreateRoutineSchema = routineBaseSchema
  .extend({
    pipelineId: z.string(),
    cronExpression: z.string().nullable().optional(),
    eventType: z.string().nullable().optional(),
    eventConfig: z.record(z.string(), z.unknown()).nullable().optional(),
    inputConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .superRefine(validateRoutineTrigger);
export type CreateRoutineInput = z.infer<typeof CreateRoutineSchema>;

export const UpdateRoutineSchema = routineBaseSchema
  .partial()
  .extend({
    pipelineId: z.string().optional(),
    cronExpression: z.string().nullable().optional(),
    eventType: z.string().nullable().optional(),
    eventConfig: z.record(z.string(), z.unknown()).nullable().optional(),
    inputConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.triggerType !== undefined ||
      data.cronExpression !== undefined ||
      data.eventType !== undefined ||
      data.enabled !== undefined
    ) {
      validateRoutineTrigger(
        {
          triggerType: data.triggerType ?? "cron",
          cronExpression: data.cronExpression ?? null,
          eventType: data.eventType ?? null,
          eventConfig: data.eventConfig ?? null,
          inputConfig: data.inputConfig ?? null,
          enabled: data.enabled ?? true,
        },
        ctx,
      );
    }
  });
export type UpdateRoutineInput = z.infer<typeof UpdateRoutineSchema>;
