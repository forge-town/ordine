import { z } from "zod/v4";

export const NODE_TYPE_ENUM = {
  COMPOUND: "compound",
  CODE_FILE: "code-file",
  FOLDER: "folder",
  GITHUB_PROJECT: "github-projects",
  OPERATION: "operation",
  OUTPUT_PROJECT_PATH: "output-project-path",
  OUTPUT_LOCAL_PATH: "output-local-path",
  PROMPT: "prompt",
} as const;

export const BuiltinNodeTypeSchema = z.enum(NODE_TYPE_ENUM);
export type BuiltinNodeType = z.infer<typeof BuiltinNodeTypeSchema>;
