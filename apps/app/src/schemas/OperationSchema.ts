import { z } from "zod/v4";
import { OBJECT_TYPES, VISIBILITY_OPTIONS } from "@/models/tables/operations_table";

export const ObjectTypeSchema = z.enum(OBJECT_TYPES);
export type ObjectType = z.infer<typeof ObjectTypeSchema>;

export const VisibilitySchema = z.enum(VISIBILITY_OPTIONS);
export type Visibility = z.infer<typeof VisibilitySchema>;
