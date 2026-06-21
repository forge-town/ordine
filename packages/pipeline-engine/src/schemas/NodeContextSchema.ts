import { z } from "zod/v4";
import type { PipelineNode } from "@repo/schemas";
import type { PipelineEngineDeps } from "../deps";
import { NodeCtxSchema } from "./NodeCtxSchema";

export const NodeContextSchema = z.object({
  node: z.custom<PipelineNode>(),
  input: NodeCtxSchema,
  deps: z.custom<PipelineEngineDeps>(),
  nodeOutputs: z.map(z.string(), NodeCtxSchema),
  tempDirs: z.array(z.string()),
  jobId: z.string(),
  defaultOutputPath: z.string().optional(),
});
export type NodeContext = z.infer<typeof NodeContextSchema>;
