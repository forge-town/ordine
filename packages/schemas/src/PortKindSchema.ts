import { z } from "zod/v4";

export const PortKindSchema = z.enum(["text", "file", "folder", "project"]);
export type PortKind = z.infer<typeof PortKindSchema>;
