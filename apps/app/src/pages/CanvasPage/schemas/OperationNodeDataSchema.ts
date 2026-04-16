import { z } from "zod/v4";
import { LLM_PROVIDERS } from "@repo/db-schema";
import { OperationNodeDataSchema as EngineOperationNodeDataSchema } from "@repo/pipeline-engine/schemas";

export const OperationNodeDataSchema = EngineOperationNodeDataSchema.extend({
  llmProvider: z.enum(LLM_PROVIDERS).optional(),
});

export type OperationNodeData = z.infer<typeof OperationNodeDataSchema>;
