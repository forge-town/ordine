import { z } from "zod/v4";
import { AgentRuntimeSchema } from "./AgentRuntimeSchema";
import { RuntimeModelSchema } from "./RuntimeModelSchema";
import { RuntimeAdapterManifestSchema } from "./RuntimeAdapterManifestSchema";

export const DetectedRuntimeSchema = z.object({
  type: AgentRuntimeSchema,
  binaryName: z.string().min(1),
  path: z.string().min(1),
  version: z.string().min(1).optional(),
  models: z.array(RuntimeModelSchema).optional(),
  compatibility: RuntimeAdapterManifestSchema.optional(),
});
export type DetectedRuntime = z.infer<typeof DetectedRuntimeSchema>;
