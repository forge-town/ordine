import { z } from "zod/v4";

export const WorkspacePhaseSchema = z.enum([
  "empty",
  "clarify",
  "proposal",
  "applied",
  "running",
  "done",
]);

export type WorkspacePhase = z.infer<typeof WorkspacePhaseSchema>;
