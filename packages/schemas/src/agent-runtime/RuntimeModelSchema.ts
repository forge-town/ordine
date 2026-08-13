import { z } from "zod/v4";

export const RuntimeModelCapabilityOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});
export type RuntimeModelCapabilityOption = z.infer<typeof RuntimeModelCapabilityOptionSchema>;

export const RuntimeModelSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  defaultReasoningEffort: z.string().min(1).optional(),
  reasoningEfforts: z.array(RuntimeModelCapabilityOptionSchema).optional(),
  defaultSpeed: z.string().min(1).optional(),
  speeds: z.array(RuntimeModelCapabilityOptionSchema).optional(),
  supportsImageInput: z.boolean().optional(),
});
export type RuntimeModel = z.infer<typeof RuntimeModelSchema>;
