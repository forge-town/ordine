import { z } from "zod/v4";

export const PORT_KIND_ENUM = {
  TEXT: "text",
  FILE: "file",
  FOLDER: "folder",
  PROJECT: "project",
} as const;

export const PortKindSchema = z.enum(PORT_KIND_ENUM);
export type PortKind = z.infer<typeof PortKindSchema>;
