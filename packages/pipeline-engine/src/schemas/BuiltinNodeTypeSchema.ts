import { z } from "zod/v4";

export const BuiltinNodeTypeSchema = z.enum([
  "compound",
  "condition",
  "code-file",
  "folder",
  "github-project",
  "operation",
  "output-project-path",
  "output-local-path",
]);
export type BuiltinNodeType = z.infer<typeof BuiltinNodeTypeSchema>;
