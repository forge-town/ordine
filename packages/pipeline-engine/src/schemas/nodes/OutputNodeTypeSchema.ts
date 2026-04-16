import { z } from "zod/v4";

export const OutputNodeTypeSchema = z.enum(["output-project-path", "output-local-path"]);
export type OutputNodeType = z.infer<typeof OutputNodeTypeSchema>;

export const OUTPUT_TYPES: OutputNodeType[] = ["output-project-path", "output-local-path"];
