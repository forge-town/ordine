import { z } from "zod/v4";

export const OUTPUT_NODE_TYPE_ENUM = {
  OUTPUT_PROJECT_PATH: "output-project-path",
  OUTPUT_LOCAL_PATH: "output-local-path",
} as const;

export const OutputNodeTypeSchema = z.enum(OUTPUT_NODE_TYPE_ENUM);
export type OutputNodeType = z.infer<typeof OutputNodeTypeSchema>;
