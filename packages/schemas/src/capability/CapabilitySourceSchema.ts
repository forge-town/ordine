import { z } from "zod/v4";
import { AgentRuntimeSchema } from "../agent-runtime/AgentRuntimeSchema";

export const CapabilitySourceIdSchema = z.union([AgentRuntimeSchema, z.literal("cursor")]);
export type CapabilitySourceId = z.infer<typeof CapabilitySourceIdSchema>;

export const CapabilitySourceScopeSchema = z.enum(["global", "workspace"]);
export type CapabilitySourceScope = z.infer<typeof CapabilitySourceScopeSchema>;

export const CapabilityOriginSchema = z.enum(["manual", "harvested", "builtin"]);
export type CapabilityOrigin = z.infer<typeof CapabilityOriginSchema>;

export const CapabilityCredentialReferencesSchema = z.object({
  env: z.record(z.string(), z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  bearerTokenEnv: z.string().min(1).optional(),
});
export type CapabilityCredentialReferences = z.infer<typeof CapabilityCredentialReferencesSchema>;

export const CapabilitySourceSchema = z.object({
  sourceKey: z.string().min(1),
  source: CapabilitySourceIdSchema,
  scope: CapabilitySourceScopeSchema,
  path: z.string().min(1),
  nativeName: z.string().min(1),
  enabled: z.boolean().default(true),
  credentialReferences: CapabilityCredentialReferencesSchema.optional(),
  lastSeenAt: z.string().datetime(),
});
export type CapabilitySource = z.infer<typeof CapabilitySourceSchema>;

export const EncryptedCredentialEnvelopeSchema = z.object({
  version: z.literal(1),
  algorithm: z.literal("aes-256-gcm"),
  iv: z.string().min(1),
  ciphertext: z.string().min(1),
  authTag: z.string().min(1),
});
export type EncryptedCredentialEnvelope = z.infer<typeof EncryptedCredentialEnvelopeSchema>;

export const EncryptedCredentialMapSchema = z.record(z.string(), EncryptedCredentialEnvelopeSchema);
export type EncryptedCredentialMap = z.infer<typeof EncryptedCredentialMapSchema>;
