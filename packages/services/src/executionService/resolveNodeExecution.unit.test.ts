import { describe, expect, it } from "vitest";
import {
  EXECUTION_TIMEOUT_DEFAULTS,
  type AgentRuntimeConfig,
  type RuntimeModel,
} from "@repo/schemas";
import { resolveNodeExecution, type ResolveNodeExecutionInput } from "./resolveNodeExecution";

const model = (id = "gpt-6", options: Partial<RuntimeModel> = {}): RuntimeModel => ({
  id,
  displayName: id,
  reasoningEfforts: [{ value: "high" }, { value: "xhigh" }],
  speeds: [{ value: "standard" }, { value: "fast" }],
  ...options,
});
const runtime = (
  id = "local-codex",
  models: RuntimeModel[] | undefined = [model()],
): AgentRuntimeConfig => ({
  id,
  name: id,
  type: "codex",
  connection: { mode: "local", path: "C:/configured/codex.exe", models },
});
const input = (overrides: Partial<ResolveNodeExecutionInput> = {}): ResolveNodeExecutionInput => ({
  executorKind: "agent",
  run: {},
  node: {},
  operation: { runtimeConfigId: "local-codex", model: "gpt-6" },
  settings: {},
  runtimes: [runtime()],
  ...overrides,
});
const resolved = (value: ResolveNodeExecutionInput) => {
  const result = resolveNodeExecution(value);
  expect(result.isOk(), result.isErr() ? result.error.message : undefined).toBe(true);
  if (result.isErr()) throw result.error;

  return result.value;
};
const fails = (value: ResolveNodeExecutionInput, code: string, field: string) => {
  const result = resolveNodeExecution(value);
  expect(result.isErr()).toBe(true);
  if (result.isOk()) throw new Error("Expected resolution failure");
  expect(result.error).toMatchObject({ name: "NodeExecutionResolutionError", code, field });
};

describe("resolveNodeExecution", () => {
  it.each(["run", "node", "operation", "settings"] as const)(
    "preserves an explicit zero timeout at %s",
    (layer) => {
      expect(
        resolved(input({ [layer]: { ...input()[layer], firstOutputTimeoutMs: 0 } })),
      ).toMatchObject({
        timeouts: { firstOutputTimeoutMs: 0 },
        origins: { firstOutputTimeoutMs: layer },
      });
    },
  );

  it.each(["run", "node", "operation", "settings"] as const)(
    "uses the highest applicable runtime/model/effort/speed layer: %s",
    (winner) => {
      const layers = ["run", "node", "operation", "settings"] as const;
      const value = input({ operation: {}, runtimes: [] });
      layers.forEach((layer, index) => {
        value.runtimes.push(runtime(layer, [model(layer)]));
        if (index >= layers.indexOf(winner))
          value[layer] = {
            runtimeConfigId: layer,
            model: layer,
            reasoningEffort: "high",
            speed: "fast",
          };
      });
      expect(resolved(value)).toMatchObject({
        runtimeConfigId: winner,
        model: winner,
        reasoningEffort: "high",
        speed: "fast",
        origins: { runtimeConfigId: winner, model: winner, reasoningEffort: winner, speed: winner },
      });
    },
  );

  it("rejects invalid input and node-level Job deadline overrides", () => {
    fails(input({ run: { inactivityTimeoutMs: 0 } }), "INVALID_INPUT", "run.inactivityTimeoutMs");
    const value = { ...input(), node: { firstOutputTimeoutMs: 1, activeRunTimeoutMs: 1 } };
    fails(value, "INVALID_INPUT", "node");
  });

  it("preserves the Operation runtime/model when only a timeout or effort changes", () => {
    const value = resolved(
      input({ run: { firstOutputTimeoutMs: 0 }, node: { reasoningEffort: "xhigh" } }),
    );
    expect(value).toMatchObject({
      runtimeConfigId: "local-codex",
      model: "gpt-6",
      agent: "codex",
      executablePath: "C:/configured/codex.exe",
      reasoningEffort: "xhigh",
      timeouts: { ...EXECUTION_TIMEOUT_DEFAULTS, firstOutputTimeoutMs: 0 },
      origins: {
        runtimeConfigId: "operation",
        model: "operation",
        reasoningEffort: "node",
        firstOutputTimeoutMs: "run",
        inactivityTimeoutMs: "policy",
      },
    });
    expect(value.executableSha256).toBeUndefined();
    expect(value.speed).toBeUndefined();
    expect(value.origins).not.toHaveProperty("speed");
  });

  it.each(["script", "builtin"] as const)(
    "resolves pure %s without runtimes or routing fields",
    (executorKind) => {
      const value = resolved(
        input({
          executorKind,
          runtimes: [],
          run: { model: "ignored", reasoningEffort: "unsupported" },
        }),
      );
      expect(value).toEqual({
        executorKind,
        timeouts: EXECUTION_TIMEOUT_DEFAULTS,
        origins: {
          firstOutputTimeoutMs: "policy",
          inactivityTimeoutMs: "policy",
          activeRunTimeoutMs: "policy",
          waitingTimeoutMs: "policy",
        },
      });
    },
  );

  it.each(["run", "node", "operation", "settings"] as const)(
    "resolves node timeout precedence from %s",
    (winner) => {
      const layers = ["run", "node", "operation", "settings"] as const;
      const value = input();
      layers.forEach((layer, index) => {
        if (index >= layers.indexOf(winner))
          value[layer] = {
            ...value[layer],
            firstOutputTimeoutMs: 100 + index,
            inactivityTimeoutMs: 200 + index,
          };
      });
      expect(resolved(value)).toMatchObject({
        timeouts: {
          firstOutputTimeoutMs: 100 + layers.indexOf(winner),
          inactivityTimeoutMs: 200 + layers.indexOf(winner),
        },
        origins: { firstOutputTimeoutMs: winner, inactivityTimeoutMs: winner },
      });
    },
  );

  it("resolves Job deadlines only from run/settings", () => {
    expect(
      resolved(
        input({
          run: { activeRunTimeoutMs: 900 },
          settings: { activeRunTimeoutMs: 800, waitingTimeoutMs: 700 },
        }),
      ),
    ).toMatchObject({
      timeouts: { activeRunTimeoutMs: 900, waitingTimeoutMs: 700 },
      origins: { activeRunTimeoutMs: "run", waitingTimeoutMs: "settings" },
    });
  });

  it.each(["run", "node", "operation", "settings"] as const)(
    "rejects a missing runtime selected at %s",
    (layer) => {
      fails(
        input({ operation: {}, [layer]: { runtimeConfigId: "missing" } }),
        "RUNTIME_NOT_FOUND",
        "runtimeConfigId",
      );
    },
  );
  it("never chooses the first available runtime implicitly", () => {
    fails(input({ operation: {} }), "RUNTIME_REQUIRED", "runtimeConfigId");
  });
  it("requires an explicitly configured local executable path", () => {
    fails(
      input({ runtimes: [{ ...runtime(), connection: { mode: "local", binaryName: "codex" } }] }),
      "EXECUTABLE_PATH_REQUIRED",
      "executablePath",
    );
    fails(
      input({
        runtimes: [{ ...runtime(), connection: { mode: "ssh", host: "remote", user: "user" } }],
      }),
      "RUNTIME_UNSUPPORTED",
      "runtimeConfigId",
    );
  });

  it("does not inherit another runtime's model, effort, or speed", () => {
    const value = resolved(
      input({
        run: { runtimeConfigId: "second" },
        operation: {
          runtimeConfigId: "local-codex",
          model: "gpt-6",
          reasoningEffort: "high",
          speed: "fast",
        },
        runtimes: [runtime(), runtime("second", [model("another")])],
      }),
    );
    expect(value).toMatchObject({
      runtimeConfigId: "second",
      model: "another",
      origins: { runtimeConfigId: "run", model: "runtime" },
    });
    expect(value.reasoningEffort).toBeUndefined();
    expect(value.speed).toBeUndefined();
  });
  it("can inherit a matching runtime/model from a lower settings layer", () => {
    const value = resolved(
      input({
        run: { runtimeConfigId: "second" },
        operation: { runtimeConfigId: "local-codex", model: "gpt-6" },
        settings: { runtimeConfigId: "second", model: "another", reasoningEffort: "high" },
        runtimes: [runtime(), runtime("second", [model("another"), model("extra")])],
      }),
    );
    expect(value).toMatchObject({
      model: "another",
      reasoningEffort: "high",
      origins: { model: "settings", reasoningEffort: "settings" },
    });
  });
  it("does not inherit effort/speed bound to a different model", () => {
    const value = resolved(
      input({
        node: { model: "another" },
        operation: {
          runtimeConfigId: "local-codex",
          model: "gpt-6",
          reasoningEffort: "high",
          speed: "fast",
        },
        runtimes: [runtime("local-codex", [model(), model("another")])],
      }),
    );
    expect(value.model).toBe("another");
    expect(value.reasoningEffort).toBeUndefined();
    expect(value.speed).toBeUndefined();
  });

  it.each([{ models: undefined }, { models: [] }])(
    "rejects unknown model capabilities: %j",
    ({ models }) => {
      const config = runtime();
      if (config.connection.mode === "local") config.connection.models = models;
      fails(input({ runtimes: [config] }), "CAPABILITIES_UNKNOWN", "model");
    },
  );
  it.each([
    { models: [model(), model()] },
    { models: [model("a", { isDefault: true }), model("b", { isDefault: true })] },
  ])("rejects an invalid model catalog", ({ models }) => {
    fails(input({ runtimes: [runtime("local-codex", models)] }), "INVALID_CAPABILITIES", "model");
  });
  it("rejects duplicate runtime identifiers", () => {
    fails(input({ runtimes: [runtime(), runtime()] }), "INVALID_RUNTIME_CONFIG", "runtimeConfigId");
  });
  it("selects the unique declared default or unique model candidate", () => {
    expect(resolved(input({ operation: { runtimeConfigId: "local-codex" } })).origins.model).toBe(
      "runtime",
    );
    expect(
      resolved(
        input({
          operation: { runtimeConfigId: "local-codex" },
          runtimes: [runtime("local-codex", [model("a"), model("b", { isDefault: true })])],
        }),
      ).model,
    ).toBe("b");
    fails(
      input({
        operation: { runtimeConfigId: "local-codex" },
        runtimes: [runtime("local-codex", [model("a"), model("b")])],
      }),
      "MODEL_REQUIRED",
      "model",
    );
  });
  it("matches explicit runtime, model, effort and speed with exact case", () => {
    fails(
      input({ run: { runtimeConfigId: "LOCAL-CODEX" } }),
      "RUNTIME_NOT_FOUND",
      "runtimeConfigId",
    );
    fails(input({ run: { model: "GPT-6" } }), "MODEL_UNSUPPORTED", "model");
    fails(input({ run: { reasoningEffort: "HIGH" } }), "OPTION_UNSUPPORTED", "reasoningEffort");
    fails(input({ run: { speed: "FAST" } }), "OPTION_UNSUPPORTED", "speed");
  });
  it.each([{ options: undefined }, { options: [] }])(
    "rejects an explicit effort/speed when capability lists are unknown: %j",
    ({ options }) => {
      const runtimes = [
        runtime("local-codex", [model("gpt-6", { reasoningEfforts: options, speeds: options })]),
      ];
      fails(
        input({ runtimes, run: { reasoningEffort: "high" } }),
        "CAPABILITIES_UNKNOWN",
        "reasoningEffort",
      );
      fails(input({ runtimes, run: { speed: "fast" } }), "CAPABILITIES_UNKNOWN", "speed");
      expect(resolved(input({ runtimes })).reasoningEffort).toBeUndefined();
    },
  );
  it("uses consistent declared capability defaults and records their origin", () => {
    expect(
      resolved(
        input({
          runtimes: [
            runtime("local-codex", [
              model("gpt-6", {
                defaultReasoningEffort: "high",
                speeds: [{ value: "fast", isDefault: true }],
              }),
            ]),
          ],
        }),
      ),
    ).toMatchObject({
      reasoningEffort: "high",
      speed: "fast",
      origins: { reasoningEffort: "runtime", speed: "runtime" },
    });
  });
  it.each([
    { defaultReasoningEffort: "missing" },
    { defaultReasoningEffort: "high", reasoningEfforts: undefined },
    {
      defaultReasoningEffort: "high",
      reasoningEfforts: [{ value: "xhigh", isDefault: true }, { value: "high" }],
    },
    {
      reasoningEfforts: [
        { value: "high", isDefault: true },
        { value: "xhigh", isDefault: true },
      ],
    },
    { reasoningEfforts: [{ value: "high" }, { value: "high" }] },
  ])("rejects inconsistent capability defaults and duplicate options: %j", (options) => {
    fails(
      input({ runtimes: [runtime("local-codex", [model("gpt-6", options)])] }),
      "INVALID_CAPABILITIES",
      "reasoningEffort",
    );
  });
  it("lets explicit supported capability options override runtime defaults", () => {
    expect(
      resolved(
        input({
          run: { reasoningEffort: "xhigh", speed: "fast" },
          runtimes: [
            runtime("local-codex", [
              model("gpt-6", { defaultReasoningEffort: "high", defaultSpeed: "standard" }),
            ]),
          ],
        }),
      ),
    ).toMatchObject({
      reasoningEffort: "xhigh",
      speed: "fast",
      origins: { reasoningEffort: "run", speed: "run" },
    });
  });
});
