import { z } from "zod/v4";

export const WorkspaceCanvasRefSchema = z.object({
  id: z.string(),
  baseId: z.string(),
  type: z.enum(["node", "edge"]),
  label: z.string(),
  kind: z.string().default(""),
  path: z.array(z.string()).default([]),
});
export type WorkspaceCanvasRef = z.infer<typeof WorkspaceCanvasRefSchema>;
