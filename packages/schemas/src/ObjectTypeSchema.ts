import { z } from "zod/v4";

export const OBJECT_TYPES = ["file", "folder", "project"] as const;

export const ObjectTypeSchema = z.enum(OBJECT_TYPES);
export type ObjectType = z.infer<typeof ObjectTypeSchema>;
