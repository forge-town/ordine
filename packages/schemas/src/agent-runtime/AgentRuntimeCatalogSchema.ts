import { z } from "zod/v4";
import { AgentRuntimeSchema } from "./AgentRuntimeSchema";
import { RuntimeAdapterManifestSchema } from "./RuntimeAdapterManifestSchema";
import { RuntimeModelSchema } from "./RuntimeModelSchema";

export const RuntimeAvailabilitySchema = z.enum(["unavailable", "detected", "launchable"]);
export type RuntimeAvailability = z.infer<typeof RuntimeAvailabilitySchema>;

export const RuntimeAuthenticationStatusSchema = z.enum([
  "unknown",
  "authenticated",
  "unauthenticated",
  "error",
]);
export type RuntimeAuthenticationStatus = z.infer<typeof RuntimeAuthenticationStatusSchema>;

export const RuntimeModelSourceSchema = z.enum(["live", "fallback", "none"]);
export type RuntimeModelSource = z.infer<typeof RuntimeModelSourceSchema>;

export const RuntimeCatalogDiagnosticSchema = z.object({
  code: z.string().min(1),
  level: z.enum(["info", "warning", "error"]),
  message: z.string().min(1),
});
export type RuntimeCatalogDiagnostic = z.infer<typeof RuntimeCatalogDiagnosticSchema>;

export const AgentRuntimeCatalogEntrySchema = z.object({
  runtime: AgentRuntimeSchema,
  displayName: z.string().min(1),
  runtimeConfigId: z.string().min(1).nullable(),
  availability: RuntimeAvailabilitySchema,
  binaryName: z.string().min(1),
  path: z.string().min(1).nullable(),
  version: z.string().min(1).nullable(),
  authenticationStatus: RuntimeAuthenticationStatusSchema,
  authenticationMessage: z.string().min(1).nullable(),
  diagnostics: z.array(RuntimeCatalogDiagnosticSchema),
  models: z.array(RuntimeModelSchema),
  modelsSource: RuntimeModelSourceSchema,
  supportsCustomModel: z.boolean(),
  compatibility: RuntimeAdapterManifestSchema,
});
export type AgentRuntimeCatalogEntry = z.infer<typeof AgentRuntimeCatalogEntrySchema>;
