import { z } from "zod/v4";

/** Semantic port binding for a graph edge. React Flow handle IDs remain UI-only. */
export const HandoffEdgeSchema = z.object({
  kind: z.literal("handoff"),
  sourcePortId: z.string().min(1),
  targetPortId: z.string().min(1),
});
export type HandoffEdge = z.infer<typeof HandoffEdgeSchema>;
