import { describe, expect, it, vi } from "vitest";
import { errAsync, okAsync } from "neverthrow";
import type { z } from "zod/v4";
import {
  AgentRuntimeConfigSchema,
  ExecutionRuntimeConfigRecordSchema,
  ExecutionWorkspaceSettingsRecordSchema,
  OperationRevisionSchema,
  SettingsSchema,
} from "@repo/schemas";
import { createExecutionConfigurationPublisher } from "./createExecutionConfigurationPublisher";
import { ExecutionGatewayError, type createExecutionGateway } from "./createExecutionGateway";
import { resolveNodeExecution } from "../executionService/resolveNodeExecution";
import { gatewayFixture, json } from "./gatewayTestFixture";

const runtime = (id: string) =>
  AgentRuntimeConfigSchema.parse({
    id,
    name: id,
    type: "codex",
    connection: {
      mode: "local",
      path: `C:/runtime/${id}.exe`,
      models: [
        {
          id: `${id}-model`,
          displayName: id,
          isDefault: true,
          reasoningEfforts: [{ value: "high" }],
          speeds: [{ value: "fast" }],
        },
      ],
    },
  });
const agent = (runtimeConfigId?: string, model?: string) =>
  OperationRevisionSchema.parse({
    apiVersion: 2,
    id: "agent",
    revision: 1,
    name: "Agent",
    inputPorts: [],
    outputPorts: [],
    executor: { kind: "agent", instruction: "Explicit instruction" },
    executionDefaults: { runtimeConfigId, model },
  });
const setup = () => {
  const sourceRuntimes = [
    runtime("global"),
    runtime("operation"),
    runtime("node"),
    runtime("run"),
    runtime("unused"),
  ].map((config) => ({ ...config, meta: { createdAt: new Date(0), updatedAt: new Date(0) } }));
  const settings = SettingsSchema.parse({
    id: "default",
    defaultAgentRuntime: "codex",
    defaultAgentRuntimeConfigId: "global",
    agentRuntimePreferences: {
      global: {
        model: "global-model",
        reasoningEffort: "high",
        speed: "fast",
        firstOutputTimeoutSeconds: 0,
      },
    },
    defaultApiKey: "private-do-not-publish",
    defaultModel: "fallback-model",
    defaultOutputPath: "C:/not-a-runtime",
  });
  const records: z.infer<typeof ExecutionRuntimeConfigRecordSchema>[] = [];
  const workspace = ExecutionWorkspaceSettingsRecordSchema.parse({
    apiVersion: 2,
    revision: 4,
    executionDefaults: { activeRunTimeoutMs: 120_000, waitingTimeoutMs: 900_000 },
  });
  const gateway = {
    listRuntimeConfigs: vi
      .fn<ReturnType<typeof createExecutionGateway>["listRuntimeConfigs"]>()
      .mockImplementation(() => okAsync(records)),
    getWorkspaceSettings: vi
      .fn<ReturnType<typeof createExecutionGateway>["getWorkspaceSettings"]>()
      .mockImplementation(() => okAsync(workspace)),
    saveRuntimeConfig: vi
      .fn<ReturnType<typeof createExecutionGateway>["saveRuntimeConfig"]>()
      .mockImplementation((input) =>
        okAsync(
          ExecutionRuntimeConfigRecordSchema.parse({
            apiVersion: 2,
            revision: input.expectedRevision + 1,
            config: input.config,
          }),
        ),
      ),
    saveWorkspaceSettings: vi
      .fn<ReturnType<typeof createExecutionGateway>["saveWorkspaceSettings"]>()
      .mockImplementation((input) =>
        okAsync(
          ExecutionWorkspaceSettingsRecordSchema.parse({
            apiVersion: 2,
            revision: input.expectedRevision + 1,
            executionDefaults: input.executionDefaults,
          }),
        ),
      ),
  };
  const readRuntimes = vi.fn(async () => sourceRuntimes);
  const readSettings = vi.fn(async () => settings);
  const publisher = createExecutionConfigurationPublisher({ gateway, readRuntimes, readSettings });

  return {
    publisher,
    gateway,
    settings,
    sourceRuntimes,
    records,
    workspace,
    readRuntimes,
    readSettings,
  };
};

describe("authoring runtime configuration publication", () => {
  it("does not read or publish Agent settings for a pure Script graph", async () => {
    const test = setup();
    const script = OperationRevisionSchema.parse({
      ...agent(),
      executor: {
        kind: "script",
        language: "javascript",
        source: "console.log('script')",
        outputMode: "text",
      },
    });
    const result = await test.publisher.publish([script], {});
    expect(result.isOk()).toBe(true);
    expect(test.readRuntimes).not.toHaveBeenCalled();
    expect(test.readSettings).not.toHaveBeenCalled();
    expect(test.gateway.listRuntimeConfigs).not.toHaveBeenCalled();
  });

  it("publishes only explicitly referenced runtimes with CAS and keeps global defaults out of run overrides", async () => {
    const test = setup();
    test.records.push({
      apiVersion: 2,
      revision: 7,
      config: { ...runtime("operation"), name: "Old name" },
    });
    const run = { runtimeConfigId: "run", firstOutputTimeoutMs: 30_000 };
    const before = structuredClone(run);
    const result = await test.publisher.publish([agent("operation", "operation-model")], run, [
      { runtimeConfigId: "node", model: "node-model" },
    ]);
    expect(result.isOk()).toBe(true);
    expect(
      test.gateway.saveRuntimeConfig.mock.calls.map(([input]) => input.config.id).sort(),
    ).toEqual(["global", "node", "operation", "run"]);
    expect(
      test.gateway.saveRuntimeConfig.mock.calls.find(
        ([input]) => input.config.id === "operation",
      )?.[0].expectedRevision,
    ).toBe(7);
    const defaults = test.gateway.saveWorkspaceSettings.mock.calls[0]![0];
    expect(defaults).toEqual({
      apiVersion: 2,
      expectedRevision: 4,
      executionDefaults: {
        runtimeConfigId: "global",
        model: "global-model",
        reasoningEffort: "high",
        speed: "fast",
        firstOutputTimeoutMs: 0,
        activeRunTimeoutMs: 120_000,
        waitingTimeoutMs: 900_000,
      },
    });
    expect(JSON.stringify(defaults)).not.toContain("private-do-not-publish");
    expect(run).toEqual(before);
  });

  it("preserves node runtime/model when the run changes only its timeout", async () => {
    const test = setup();
    const operation = agent("operation", "operation-model");
    const run = { firstOutputTimeoutMs: 0 };
    const node = { runtimeConfigId: "node", model: "node-model" };
    const published = await test.publisher.publish([operation], run, [node]);
    expect(published.isOk()).toBe(true);
    const settings = test.gateway.saveWorkspaceSettings.mock.calls[0]![0].executionDefaults;
    const resolved = resolveNodeExecution({
      executorKind: "agent",
      run,
      node,
      operation: operation.executionDefaults,
      settings,
      runtimes: test.gateway.saveRuntimeConfig.mock.calls.map(([input]) =>
        AgentRuntimeConfigSchema.parse(input.config),
      ),
    });
    expect(resolved.isOk() && resolved.value).toMatchObject({
      runtimeConfigId: "node",
      model: "node-model",
      timeouts: { firstOutputTimeoutMs: 0 },
      origins: { runtimeConfigId: "node", model: "node", firstOutputTimeoutMs: "run" },
    });
  });

  it("skips unchanged configs and settings despite author metadata timestamps", async () => {
    const test = setup();
    test.records.push({ apiVersion: 2, revision: 2, config: runtime("global") });
    test.workspace.executionDefaults = {
      ...test.workspace.executionDefaults,
      runtimeConfigId: "global",
      model: "global-model",
      reasoningEffort: "high",
      speed: "fast",
      firstOutputTimeoutMs: 0,
    };
    test.sourceRuntimes[0]!.meta.updatedAt = new Date();
    const result = await test.publisher.publish([agent()], {});
    expect(result.isOk()).toBe(true);
    expect(test.gateway.saveRuntimeConfig).not.toHaveBeenCalled();
    expect(test.gateway.saveWorkspaceSettings).not.toHaveBeenCalled();
  });

  it("does not infer a config from runtime family or overwrite workspace selection when no default ID was saved", async () => {
    const test = setup();
    test.settings.defaultAgentRuntimeConfigId = null;
    const result = await test.publisher.publish([agent("operation", "operation-model")], {});
    expect(result.isOk()).toBe(true);
    expect(test.gateway.saveRuntimeConfig.mock.calls.map(([input]) => input.config.id)).toEqual([
      "operation",
    ]);
    expect(test.gateway.saveWorkspaceSettings).not.toHaveBeenCalled();
  });

  it("rejects a missing referenced runtime instead of choosing another installed runtime", async () => {
    const test = setup();
    const result = await test.publisher.publish([agent("missing")], {});
    expect(result.isErr()).toBe(true);
    expect(test.gateway.saveRuntimeConfig).not.toHaveBeenCalled();
  });

  it("preserves a selected .cmd path and an incompatible model for preparation to reject", async () => {
    const test = setup();
    test.sourceRuntimes[0]!.connection = {
      mode: "local",
      path: "C:/selected/codex.cmd",
      models:
        runtime("global").connection.mode === "local"
          ? [{ id: "global-model", displayName: "Global" }]
          : [],
    };
    test.settings.agentRuntimePreferences!.global!.model = "unsupported-explicit-model";
    const result = await test.publisher.publish([agent()], {});
    expect(result.isOk()).toBe(true);
    expect(test.gateway.saveRuntimeConfig.mock.calls[0]![0].config.connection).toMatchObject({
      path: "C:/selected/codex.cmd",
    });
    const defaults = test.gateway.saveWorkspaceSettings.mock.calls[0]![0].executionDefaults;
    expect(defaults.model).toBe("unsupported-explicit-model");
    const resolved = resolveNodeExecution({
      executorKind: "agent",
      run: {},
      node: {},
      operation: {},
      settings: defaults,
      runtimes: test.gateway.saveRuntimeConfig.mock.calls.map(([input]) =>
        AgentRuntimeConfigSchema.parse(input.config),
      ),
    });
    expect(resolved.isErr() && resolved.error.code).toBe("MODEL_UNSUPPORTED");
  });

  it("rejects unknown nested runtime fields instead of stripping executable configuration", async () => {
    const test = setup();
    Object.assign(test.sourceRuntimes[0]!.connection, {
      unknownCommandOverride: "must not disappear",
    });
    const result = await test.publisher.publish([agent()], {});
    expect(result.isErr()).toBe(true);
    expect(test.gateway.saveRuntimeConfig).not.toHaveBeenCalled();
  });

  it.each(["runtime", "settings"])("propagates %s CAS conflicts without retrying", async (kind) => {
    const test = setup();
    const conflict = new ExecutionGatewayError("CAS conflict", 409);
    if (kind === "runtime") test.gateway.saveRuntimeConfig.mockReturnValueOnce(errAsync(conflict));
    else test.gateway.saveWorkspaceSettings.mockReturnValueOnce(errAsync(conflict));
    const result = await test.publisher.publish([agent()], {});
    expect(result.isErr() && result.error).toBe(conflict);
    if (kind === "runtime") expect(test.gateway.saveWorkspaceSettings).not.toHaveBeenCalled();
    else expect(test.gateway.saveWorkspaceSettings).toHaveBeenCalledOnce();
  });

  it("routes runtime/settings DTOs through their authenticated v2 gateway methods", async () => {
    const test = gatewayFixture();
    test.hooks.before = (call) => {
      if (call.method === "GET" && call.path === "/api/v2/runtime-configs") return json([]);
      if (call.method === "GET" && call.path === "/api/v2/workspace-settings")
        return json({ apiVersion: 2, revision: 0, executionDefaults: {} });
      if (call.method === "PUT" && call.path === "/api/v2/runtime-configs/global")
        return json({ apiVersion: 2, revision: 1, config: runtime("global") });
      if (call.method === "PUT" && call.path === "/api/v2/workspace-settings")
        return json({
          apiVersion: 2,
          revision: 1,
          executionDefaults: { runtimeConfigId: "global" },
        });

      return undefined;
    };
    expect((await test.gateway.listRuntimeConfigs()).isOk()).toBe(true);
    expect((await test.gateway.getWorkspaceSettings()).isOk()).toBe(true);
    expect(
      (
        await test.gateway.saveRuntimeConfig({
          apiVersion: 2,
          expectedRevision: 0,
          config: runtime("global"),
        })
      ).isOk(),
    ).toBe(true);
    expect(
      (
        await test.gateway.saveWorkspaceSettings({
          apiVersion: 2,
          expectedRevision: 0,
          executionDefaults: { runtimeConfigId: "global" },
        })
      ).isOk(),
    ).toBe(true);
    expect(test.calls.map((call) => [call.method, call.path])).toEqual([
      ["GET", "/api/v2/runtime-configs"],
      ["GET", "/api/v2/workspace-settings"],
      ["PUT", "/api/v2/runtime-configs/global"],
      ["PUT", "/api/v2/workspace-settings"],
    ]);
  });
});
