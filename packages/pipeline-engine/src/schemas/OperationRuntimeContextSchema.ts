import { z } from "zod/v4";
import { OperationLocalContextSchema } from "./OperationLocalContextSchema";
import { PipelineGlobalContextSchema } from "./PipelineGlobalContextSchema";

export const OperationRuntimeContextSchema = z.object({
  pipeline: PipelineGlobalContextSchema.optional(),
  operation: OperationLocalContextSchema,
});
export type OperationRuntimeContext = z.infer<typeof OperationRuntimeContextSchema>;
