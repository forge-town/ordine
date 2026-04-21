import { z } from "zod/v4";

export const ChangeSchema = z.object({
  file: z.string().describe("Relative file path that was modified"),
  action: z.enum(["replace", "create", "delete"]),
  description: z.string().describe("What was changed"),
  findingId: z.string().optional().describe("The finding ID this change addresses"),
});
export type Change = z.infer<typeof ChangeSchema>;
