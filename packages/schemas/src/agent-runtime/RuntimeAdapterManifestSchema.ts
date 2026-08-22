import { z } from "zod/v4";
import { AgentRuntimeSchema } from "./AgentRuntimeSchema";

export const RuntimeSupportLevelSchema = z.enum(["supported", "experimental", "unsupported"]);
export type RuntimeSupportLevel = z.infer<typeof RuntimeSupportLevelSchema>;

export const RuntimeStreamFormatSchema = z.enum([
  "claude-stream-json",
  "codex-jsonl",
  "acp-json-rpc",
  "pi-rpc",
  "json-event-stream",
  "dsh-profile-jsonl",
  "jsonl",
  "plain",
]);
export type RuntimeStreamFormat = z.infer<typeof RuntimeStreamFormatSchema>;

export const RuntimeCapabilitiesSchema = z.object({
  textStreaming: z.enum(["delta", "message", "terminal"]),
  thinking: z.boolean(),
  toolEvents: z.boolean(),
  usage: z.boolean(),
  cancellation: z.enum(["protocol", "signal", "none"]),
  resume: z.enum(["protocol", "session", "cli", "none"]),
  mcpInjection: z.enum(["protocol", "config", "none"]),
  imageInput: z.boolean(),
});
export type RuntimeCapabilities = z.infer<typeof RuntimeCapabilitiesSchema>;

export const RuntimeVerificationSchema = z.object({
  platform: z.enum(["win32", "darwin", "linux"]),
  version: z.string().min(1),
  verifiedAt: z.iso.datetime(),
});
export type RuntimeVerification = z.infer<typeof RuntimeVerificationSchema>;

export const RuntimeAdapterManifestSchema = z.object({
  runtime: AgentRuntimeSchema,
  displayName: z.string().min(1),
  supportLevel: RuntimeSupportLevelSchema,
  binaries: z.array(z.string().min(1)).min(1),
  versionArgs: z.array(z.string()),
  streamFormat: RuntimeStreamFormatSchema,
  capabilities: RuntimeCapabilitiesSchema,
  setupCommand: z.array(z.string().min(1)).optional(),
  installCommand: z.array(z.string().min(1)).optional(),
  docsUrl: z.url().optional(),
  supportsCustomModel: z.boolean().optional(),
  verification: z.array(RuntimeVerificationSchema).optional(),
  diagnostic: z.string().min(1).optional(),
});
export type RuntimeAdapterManifest = z.infer<typeof RuntimeAdapterManifestSchema>;
