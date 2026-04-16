import { z } from "zod/v4";

export const ObjectNodeTypeSchema = z.enum(["code-file", "folder", "github-project"]);
export type ObjectNodeType = z.infer<typeof ObjectNodeTypeSchema>;

export const OBJECT_TYPES: ObjectNodeType[] = ["code-file", "folder", "github-project"];
