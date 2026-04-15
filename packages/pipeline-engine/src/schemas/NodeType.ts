import { z } from "zod/v4";

export const NodeTypeSchema = z.enum([
  "compound",
  "condition",
  "code-file",
  "folder",
  "github-project",
  "operation",
  "output-project-path",
  "output-local-path",
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;
