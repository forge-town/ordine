import { z } from "zod/v4";

export const WorkObjectSchema = z.object({
  type: z.enum(["file", "folder", "project"]),
  path: z.string(),
});
export type WorkObject = z.infer<typeof WorkObjectSchema>;
