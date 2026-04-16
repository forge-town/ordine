import { z } from "zod/v4";
import { OBJECT_TYPES } from "@repo/db-schema";

export const ObjectTypeSchema = z.enum(OBJECT_TYPES);
export type ObjectType = z.infer<typeof ObjectTypeSchema>;
