import { z } from "zod";
import { AgentRuntimeCatalogEntrySchema, type AgentRuntimeCatalogEntry } from "@repo/schemas";

const AgentRuntimeCatalogSchema = z.array(AgentRuntimeCatalogEntrySchema);

export const getAgentRuntimeCatalogData = (value: unknown): AgentRuntimeCatalogEntry[] => {
  const direct = AgentRuntimeCatalogSchema.safeParse(value);
  if (direct.success) return direct.data;
  if (typeof value !== "object" || value === null || !("data" in value)) return [];
  const nested = AgentRuntimeCatalogSchema.safeParse(value.data);

  return nested.success ? nested.data : [];
};
