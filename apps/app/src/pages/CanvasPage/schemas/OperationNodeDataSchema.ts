import type { z } from "zod/v4";
import { AgentRuntimeSchema } from "@repo/schemas";
import { OperationNodeDataSchema as EngineOperationNodeDataSchema } from "@repo/pipeline-engine/schemas";

export const OperationNodeDataSchema = EngineOperationNodeDataSchema.extend({
  llmProvider: AgentRuntimeSchema.optional(),
});

export type OperationNodeData = z.infer<typeof OperationNodeDataSchema>;
