import { z } from "zod/v4";

export const OBJECT_TYPE_ENUM = {
  FILE: "file",
  FOLDER: "folder",
  PROJECT: "project",
} as const;

export const ObjectTypeSchema = z.enum(OBJECT_TYPE_ENUM);
export type ObjectType = z.infer<typeof ObjectTypeSchema>;
