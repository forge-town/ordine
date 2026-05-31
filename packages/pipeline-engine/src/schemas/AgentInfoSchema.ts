import { z } from "zod/v4";

export const AgentInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultRuntime: z.string().nullable(),
});
export type AgentInfo = z.infer<typeof AgentInfoSchema>;
