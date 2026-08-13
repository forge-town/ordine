import { z } from "zod/v4";

export const AgentInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultRuntime: z.string().nullable(),
  defaultModel: z.string().nullable().optional(),
});
export type AgentInfo = z.infer<typeof AgentInfoSchema>;
