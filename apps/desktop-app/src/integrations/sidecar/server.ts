import { invoke } from "@tauri-apps/api/core";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

export const DesktopStatusSchema = z.object({
  phase: z.enum(["idle", "starting", "ready", "failed", "stopping", "stopped"]),
  instanceId: z.string(),
  workspaceId: z.string(),
  port: z.number().int().positive().nullable(),
  error: z.string().nullable(),
  databaseConfigured: z.boolean(),
});
export const DesktopCredentialsSchema = z.object({
  baseUrl: z.string().url(),
  appToken: z.string().min(64),
  instanceId: z.string().uuid(),
  workspaceId: z.string(),
});
export const DesktopConfigurationSchema = z.object({
  databaseUrl: z.string().min(1),
  schema: z.string().optional(),
  initialize: z.boolean(),
  saveConfiguration: z.boolean(),
});
export type DesktopStatus = z.infer<typeof DesktopStatusSchema>;
export type DesktopCredentials = z.infer<typeof DesktopCredentialsSchema>;
export type DesktopConfiguration = z.infer<typeof DesktopConfigurationSchema>;

const nativeError = (error: unknown): Error =>
  new Error(typeof error === "string" ? error : "The native Desktop connection is unavailable.");
export const readNativeStatus = () =>
  ResultAsync.fromPromise(invoke("execution_status").then(DesktopStatusSchema.parse), nativeError);
export const readNativeCredentials = () =>
  ResultAsync.fromPromise(
    invoke("execution_credentials").then(DesktopCredentialsSchema.parse),
    nativeError,
  );
export const retryNativeServer = (configuration?: DesktopConfiguration) =>
  ResultAsync.fromPromise(
    invoke("execution_retry", { configuration: configuration ?? null }).then(
      DesktopStatusSchema.parse,
    ),
    nativeError,
  );
export const readMcpConfiguration = () =>
  ResultAsync.fromPromise(invoke("execution_mcp_configuration"), nativeError);
