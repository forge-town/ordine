import { z } from "zod/v4";

export const OBJECT_NODE_TYPE_ENUM = {
  FILE: "file",
  FOLDER: "folder",
  GITHUB_PROJECT: "github-project",
  PROMPT: "prompt",
} as const;
export const ObjectNodeTypeSchema = z.enum(OBJECT_NODE_TYPE_ENUM);
export type ObjectNodeType = z.infer<typeof ObjectNodeTypeSchema>;
