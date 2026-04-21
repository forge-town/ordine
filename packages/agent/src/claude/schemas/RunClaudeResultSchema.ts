import { z } from "zod/v4";
import { ClaudeStreamEventSchema } from "./ClaudeStreamEventSchema";

export const RunClaudeResultSchema = z.object({
  text: z.string(),
  events: z.array(ClaudeStreamEventSchema),
});

export type RunClaudeResult = z.infer<typeof RunClaudeResultSchema>;
