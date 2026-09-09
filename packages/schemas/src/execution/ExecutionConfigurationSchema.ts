import { z } from "zod/v4";
import { AgentRuntimeConfigSchema } from "../agent-runtime/AgentRuntimeConfigSchema";
import { LocalConnectionSchema } from "../agent-runtime/LocalConnectionSchema";
import { SshConnectionSchema } from "../agent-runtime/SshConnectionSchema";
import { ExecutionApiVersionSchema, ExecutionRequestIdSchema } from "./ExecutionProtocolSchema";
import { ExecutionOverridesSchema } from "./ExecutionOptionsSchema";
import { ExecutionInputAssetSchema } from "./ExecutionInputAssetSchema";

const RuntimeConfigurationSchema = AgentRuntimeConfigSchema.strict().extend({
  connection: z.discriminatedUnion("mode", [
    LocalConnectionSchema.strict(),
    SshConnectionSchema.strict(),
  ]),
});
export const ExecutionRuntimeConfigRecordSchema = z.strictObject({
  apiVersion: ExecutionApiVersionSchema,
  revision: z.number().int().positive(),
  config: RuntimeConfigurationSchema,
});
export const ExecutionWorkspaceSettingsRecordSchema = z.strictObject({
  apiVersion: ExecutionApiVersionSchema,
  revision: z.number().int().nonnegative(),
  executionDefaults: ExecutionOverridesSchema,
});
export const SaveExecutionRuntimeConfigSchema = z.strictObject({
  apiVersion: ExecutionApiVersionSchema,
  expectedRevision: z.number().int().nonnegative(),
  config: RuntimeConfigurationSchema,
});
export const SaveExecutionWorkspaceSettingsSchema = z.strictObject({
  apiVersion: ExecutionApiVersionSchema,
  expectedRevision: z.number().int().nonnegative(),
  executionDefaults: ExecutionOverridesSchema,
});
export const EXECUTION_MAX_INPUT_ASSET_BYTES = 8 * 1024 * 1024;
export const ImportExecutionInputSchema = z.strictObject({
  importRequestId: ExecutionRequestIdSchema,
  name: ExecutionInputAssetSchema.shape.name,
  mimeType: ExecutionInputAssetSchema.shape.mimeType,
  contentBase64: z
    .string()
    .max(4 * Math.ceil(EXECUTION_MAX_INPUT_ASSET_BYTES / 3))
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u),
});
