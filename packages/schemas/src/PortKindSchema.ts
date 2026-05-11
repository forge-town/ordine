import { z } from "zod/v4";

export const PORT_KIND_ENUM = {
  FILE: "file",
  FOLDER: "folder",
  GITHUB_PROJECT: "github-project",
  PROMPT: "prompt",
} as const;

export const PortKindSchema = z.enum(PORT_KIND_ENUM);
export type PortKind = z.infer<typeof PortKindSchema>;
