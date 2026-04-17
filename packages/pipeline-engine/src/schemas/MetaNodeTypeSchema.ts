import { z } from "zod/v4";

export const MetaNodeTypeSchema = z.enum(["object", "operation", "output"]);
export type MetaNodeType = z.infer<typeof MetaNodeTypeSchema>;
