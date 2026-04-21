import { z } from "zod/v4";

export const NodeCtxSchema = z.object({
  inputPath: z.string(),
  content: z.string(),
});
export type NodeCtx = z.infer<typeof NodeCtxSchema>;
