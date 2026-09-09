import { ResultAsync, type Result } from "neverthrow";
import { z } from "zod/v4";
import {
  AgentRuntimeConfigSchema,
  AgentRuntimePreferenceSchema,
  ExecutionOverridesSchema,
  MetaSchema,
  NodeExecutionOverridesSchema,
  OperationRevisionSchema,
  SaveExecutionRuntimeConfigSchema,
  SettingsSchema,
  type ExecutionOverrides,
  type NodeExecutionOverrides,
  type OperationRevision,
} from "@repo/schemas";
import type { createExecutionGateway } from "./createExecutionGateway";
import { contentIdentity } from "./submissionRecovery";

export type PublishExecutionConfiguration = (
  operations: readonly OperationRevision[],
  executionOverrides: ExecutionOverrides,
  nodeOverrides?: readonly NodeExecutionOverrides[],
) => ResultAsync<void, Error>;

const unwrap = <T>(result: Result<T, Error>): T => {
  if (result.isErr()) throw result.error;

  return result.value;
};
const stripMetadata = (raw: unknown): Record<string, unknown> => {
  const record = z.record(z.string(), z.unknown()).parse(raw);
  const { meta, ...fields } = record;
  if (meta !== undefined) MetaSchema.strict().parse(meta);

  return fields;
};
const rejectDroppedFields = (raw: unknown, parsed: unknown, path = "runtime") => {
  if (!raw || typeof raw !== "object") return;
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (!parsed || typeof parsed !== "object" || !Object.hasOwn(parsed, key))
      throw new Error(`${path}.${key} 不是支持的运行配置字段。`);
    rejectDroppedFields(value, (parsed as Record<string, unknown>)[key], `${path}.${key}`);
  }
};

/** Publishes stored author choices without selecting an installed runtime or model for the user. */
export const createExecutionConfigurationPublisher = (options: {
  gateway: Pick<
    ReturnType<typeof createExecutionGateway>,
    "listRuntimeConfigs" | "saveRuntimeConfig" | "getWorkspaceSettings" | "saveWorkspaceSettings"
  >;
  readRuntimes: () => Promise<unknown>;
  readSettings: () => Promise<unknown>;
}) => {
  const publish: PublishExecutionConfiguration = (
    operations,
    executionOverrides,
    nodeOverrides = [],
  ) =>
    ResultAsync.fromPromise(
      (async () => {
        const agents = operations.filter((operation) => operation.executor.kind === "agent");
        if (agents.length === 0) return;
        const agentOperations = z.array(OperationRevisionSchema).parse(agents);
        const run = ExecutionOverridesSchema.parse(executionOverrides);
        const nodes = z.array(NodeExecutionOverridesSchema).parse(nodeOverrides);
        const [rawRuntimes, rawSettings] = await Promise.all([
          options.readRuntimes(),
          options.readSettings(),
        ]);
        const runtimeRows = z.array(z.record(z.string(), z.unknown())).parse(rawRuntimes);
        const settingsSource = rawSettings == null ? undefined : stripMetadata(rawSettings);
        const settings =
          settingsSource === undefined
            ? undefined
            : SettingsSchema.omit({ meta: true }).strict().parse(settingsSource);
        if (settingsSource) rejectDroppedFields(settingsSource, settings, "settings");
        const defaultId = settings?.defaultAgentRuntimeConfigId;
        const references = new Set(
          [
            run.runtimeConfigId,
            ...nodes.map((node) => node.runtimeConfigId),
            ...agentOperations.map((operation) => operation.executionDefaults.runtimeConfigId),
            defaultId,
          ].filter((id): id is string => typeof id === "string"),
        );
        const configurations = [...references].map((id) => {
          const matches = runtimeRows.filter((row) => row.id === id);
          if (matches.length !== 1)
            throw new Error(`实际引用的运行配置 ${id} 不存在或不唯一；请显式选择并保存运行配置。`);
          const source = stripMetadata(matches[0]);
          const config = SaveExecutionRuntimeConfigSchema.shape.config.parse(source);
          AgentRuntimeConfigSchema.strict().parse(config);
          rejectDroppedFields(source, config);

          return config;
        });
        const [records, workspace] = await Promise.all([
          options.gateway.listRuntimeConfigs(),
          options.gateway.getWorkspaceSettings(),
        ]);
        const heads = unwrap(records);
        const currentSettings = unwrap(workspace);
        for (const config of configurations) {
          const matches = heads.filter((record) => record.config.id === config.id);
          if (matches.length > 1) throw new Error(`已发布运行配置 ${config.id} 不唯一。`);
          const current = matches[0];
          if (current && contentIdentity(current.config) === contentIdentity(config)) continue;
          unwrap(
            await options.gateway.saveRuntimeConfig({
              apiVersion: 2,
              expectedRevision: current?.revision ?? 0,
              config,
            }),
          );
        }
        // No stored config ID means no authority to replace the published workspace selection.
        // Single-run and node/Operation choices never become workspace defaults.
        if (!defaultId || !settings) return;
        const preference = AgentRuntimePreferenceSchema.strict().parse(
          settings.agentRuntimePreferences?.[defaultId] ?? {},
        );
        const managedFields = new Set([
          "runtimeConfigId",
          "model",
          "reasoningEffort",
          "speed",
          "firstOutputTimeoutMs",
        ]);
        const executionDefaults = ExecutionOverridesSchema.parse({
          ...Object.fromEntries(
            Object.entries(currentSettings.executionDefaults).filter(
              ([key]) => !managedFields.has(key),
            ),
          ),
          runtimeConfigId: defaultId,
          ...(preference.model || settings.defaultModel
            ? { model: preference.model ?? settings.defaultModel }
            : {}),
          ...(preference.reasoningEffort === undefined
            ? {}
            : { reasoningEffort: preference.reasoningEffort }),
          ...(preference.speed === undefined ? {} : { speed: preference.speed }),
          ...(preference.firstOutputTimeoutSeconds === undefined
            ? {}
            : { firstOutputTimeoutMs: preference.firstOutputTimeoutSeconds * 1000 }),
        });
        if (
          contentIdentity(currentSettings.executionDefaults) !== contentIdentity(executionDefaults)
        ) {
          unwrap(
            await options.gateway.saveWorkspaceSettings({
              apiVersion: 2,
              expectedRevision: currentSettings.revision,
              executionDefaults,
            }),
          );
        }
      })(),
      (cause) => (cause instanceof Error ? cause : new Error("运行配置发布失败。")),
    );

  return { publish };
};
