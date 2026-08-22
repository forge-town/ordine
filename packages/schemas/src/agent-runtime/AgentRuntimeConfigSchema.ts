import { z } from "zod/v4";
import { AgentRuntimeSchema } from "./AgentRuntimeSchema";
import { AgentRuntimeConnectionSchema } from "./AgentRuntimeConnectionSchema";
import { RuntimeAdapterManifestSchema } from "./RuntimeAdapterManifestSchema";

export const AgentRuntimeConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: AgentRuntimeSchema,
  connection: AgentRuntimeConnectionSchema,
  compatibility: RuntimeAdapterManifestSchema.optional(),
});
export type AgentRuntimeConfig = z.infer<typeof AgentRuntimeConfigSchema>;
