import { z } from "zod/v4";
import {
  CapabilityCredentialReferencesSchema,
  CapabilitySourceIdSchema,
  CapabilitySourceScopeSchema,
  McpConnectorConfigSchema,
} from "@repo/schemas";

export const CapabilitySupportStatusSchema = z.enum(["supported", "unsupported", "not_applicable"]);
export type CapabilitySupportStatus = z.infer<typeof CapabilitySupportStatusSchema>;

export const CapabilitySupportSchema = z.object({
  mcp: CapabilitySupportStatusSchema,
  skills: CapabilitySupportStatusSchema,
});
export type CapabilitySupport = z.infer<typeof CapabilitySupportSchema>;

export const CapabilityParseDiagnosticSchema = z.object({
  code: z.enum(["invalid-root", "invalid-server"]),
  message: z.string(),
  nativeName: z.string().optional(),
});
export type CapabilityParseDiagnostic = z.infer<typeof CapabilityParseDiagnosticSchema>;

export const CapabilityCredentialsSchema = z.object({
  env: z.record(z.string(), z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});
export type CapabilityCredentials = z.infer<typeof CapabilityCredentialsSchema>;

export const ParsedMcpServerSchema = z.object({
  nativeName: z.string().min(1),
  enabled: z.boolean(),
  config: McpConnectorConfigSchema,
  credentials: CapabilityCredentialsSchema.optional(),
  credentialReferences: CapabilityCredentialReferencesSchema.optional(),
});
export type ParsedMcpServer = z.infer<typeof ParsedMcpServerSchema>;

export const CapabilityParseResultSchema = z.object({
  servers: z.array(ParsedMcpServerSchema),
  diagnostics: z.array(CapabilityParseDiagnosticSchema),
});
export type CapabilityParseResult = z.infer<typeof CapabilityParseResultSchema>;

export const CapabilityAdapterContextSchema = z.object({
  homeDir: z.string().min(1),
  workspacePath: z.string().min(1).optional(),
  env: z.record(z.string(), z.string().optional()).default({}),
});
export type CapabilityAdapterContext = z.infer<typeof CapabilityAdapterContextSchema>;

export const CapabilityConfigCandidateSchema = z.object({
  source: CapabilitySourceIdSchema,
  scope: CapabilitySourceScopeSchema,
  path: z.string().min(1),
  selector: z.string().optional(),
});
export type CapabilityConfigCandidate = z.infer<typeof CapabilityConfigCandidateSchema>;

export class CapabilityParseError extends Error {
  constructor(format: string, cause: unknown) {
    super(`Unable to parse ${format} capability config`, { cause });
    this.name = "CapabilityParseError";
  }
}
