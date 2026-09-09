import {
  AgentRuntimeConfigSchema,
  EXECUTION_TIMEOUT_DEFAULTS,
  ExecutionOverridesSchema,
  NodeExecutionOverridesSchema,
  ResolvedNodeExecutionSchema,
  type ExecutionOverrides,
  type ExecutionTimeouts,
  type ResolvedNodeExecution,
  type RuntimeModel,
} from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod/v4";
import { NodeExecutionResolutionError } from "./errors";

/** Internal service dependency input. Runtime configurations must come from trusted storage. */
export const ResolveNodeExecutionInputSchema = z.strictObject({
  executorKind: ResolvedNodeExecutionSchema.shape.executorKind,
  run: ExecutionOverridesSchema,
  node: NodeExecutionOverridesSchema,
  operation: NodeExecutionOverridesSchema,
  settings: ExecutionOverridesSchema,
  runtimes: z.array(AgentRuntimeConfigSchema),
});
export type ResolveNodeExecutionInput = z.infer<typeof ResolveNodeExecutionInputSchema>;

const ExecutionLayerSchema = z.object({
  origin: z.enum(["run", "node", "operation", "settings"]),
  options: ExecutionOverridesSchema,
});
type ExecutionLayer = z.infer<typeof ExecutionLayerSchema>;

const firstOption = <K extends keyof ExecutionOverrides>(layers: ExecutionLayer[], field: K) => {
  for (const layer of layers) {
    const value = layer.options[field];
    if (value !== undefined) return { value, origin: layer.origin };
  }

  return undefined;
};

const parseResolved = (
  value: ResolvedNodeExecution,
): Result<ResolvedNodeExecution, NodeExecutionResolutionError> => {
  const parsed = ResolvedNodeExecutionSchema.safeParse(value);
  if (!parsed.success) {
    return err(
      new NodeExecutionResolutionError(
        "INVALID_RESOLVED_EXECUTION",
        parsed.error.issues[0]?.path.join(".") ?? "execution",
        "Resolved execution violates the execution contract",
      ),
    );
  }

  return ok(parsed.data);
};

const resolveCapability = (
  model: RuntimeModel,
  field: "reasoningEffort" | "speed",
  layers: ExecutionLayer[],
) => {
  const options = field === "reasoningEffort" ? model.reasoningEfforts : model.speeds;
  const declaredDefault =
    field === "reasoningEffort" ? model.defaultReasoningEffort : model.defaultSpeed;
  const markedDefaults = options?.filter((option) => option.isDefault) ?? [];
  const defaultValue = declaredDefault ?? markedDefaults[0]?.value;
  if (
    new Set(options?.map((option) => option.value)).size !== (options?.length ?? 0) ||
    markedDefaults.length > 1 ||
    (declaredDefault !== undefined &&
      markedDefaults.length === 1 &&
      declaredDefault !== markedDefaults[0]?.value) ||
    (defaultValue !== undefined && !options?.some((option) => option.value === defaultValue))
  ) {
    return err(
      new NodeExecutionResolutionError(
        "INVALID_CAPABILITIES",
        field,
        "Runtime capability options or defaults are inconsistent",
      ),
    );
  }

  const selected = firstOption(layers, field);
  if (selected !== undefined) {
    if (!options?.length)
      return err(
        new NodeExecutionResolutionError(
          "CAPABILITIES_UNKNOWN",
          field,
          "The selected model does not declare this capability",
        ),
      );
    if (!options.some((option) => option.value === selected.value))
      return err(
        new NodeExecutionResolutionError(
          "OPTION_UNSUPPORTED",
          field,
          "The selected model does not support the requested option",
        ),
      );

    return ok(selected);
  }

  return ok(
    defaultValue === undefined ? undefined : { value: defaultValue, origin: "runtime" as const },
  );
};

/** Resolves declared configuration only; executable identity and live capabilities are verified later. */
export const resolveNodeExecution = (
  input: ResolveNodeExecutionInput,
): Result<ResolvedNodeExecution, NodeExecutionResolutionError> => {
  const parsed = ResolveNodeExecutionInputSchema.safeParse(input);
  if (!parsed.success)
    return err(
      new NodeExecutionResolutionError(
        "INVALID_INPUT",
        parsed.error.issues[0]?.path.join(".") ?? "input",
        "Execution configuration is invalid",
      ),
    );
  const config = parsed.data;
  const layers: ExecutionLayer[] = [
    { origin: "run", options: config.run },
    { origin: "node", options: config.node },
    { origin: "operation", options: config.operation },
    { origin: "settings", options: config.settings },
  ];
  const jobLayers = layers.filter((layer) => layer.origin === "run" || layer.origin === "settings");
  const origins: ResolvedNodeExecution["origins"] = {};
  const timeouts: ExecutionTimeouts = { ...EXECUTION_TIMEOUT_DEFAULTS };
  for (const field of [
    "firstOutputTimeoutMs",
    "inactivityTimeoutMs",
    "activeRunTimeoutMs",
    "waitingTimeoutMs",
  ] as const) {
    const selected = firstOption(
      field === "activeRunTimeoutMs" || field === "waitingTimeoutMs" ? jobLayers : layers,
      field,
    );
    timeouts[field] = selected?.value ?? EXECUTION_TIMEOUT_DEFAULTS[field];
    origins[field] = selected?.origin ?? "policy";
  }

  if (config.executorKind !== "agent")
    return parseResolved({ executorKind: config.executorKind, timeouts, origins });

  const runtimeSelection = firstOption(layers, "runtimeConfigId");
  if (runtimeSelection === undefined)
    return err(
      new NodeExecutionResolutionError(
        "RUNTIME_REQUIRED",
        "runtimeConfigId",
        "Agent execution requires a runtime selection",
      ),
    );
  const matchingRuntimes = config.runtimes.filter(
    (runtime) => runtime.id === runtimeSelection.value,
  );
  if (matchingRuntimes.length > 1)
    return err(
      new NodeExecutionResolutionError(
        "INVALID_RUNTIME_CONFIG",
        "runtimeConfigId",
        "Runtime identifiers must be unique",
      ),
    );
  const runtime = matchingRuntimes[0];
  if (runtime === undefined)
    return err(
      new NodeExecutionResolutionError(
        "RUNTIME_NOT_FOUND",
        "runtimeConfigId",
        "The selected runtime configuration does not exist",
      ),
    );
  if (runtime.connection.mode !== "local")
    return err(
      new NodeExecutionResolutionError(
        "RUNTIME_UNSUPPORTED",
        "runtimeConfigId",
        "Only local Agent runtimes are supported",
      ),
    );
  if (!runtime.connection.path?.trim())
    return err(
      new NodeExecutionResolutionError(
        "EXECUTABLE_PATH_REQUIRED",
        "executablePath",
        "The selected runtime requires a configured executable path",
      ),
    );

  const models = runtime.connection.models;
  if (!models?.length)
    return err(
      new NodeExecutionResolutionError(
        "CAPABILITIES_UNKNOWN",
        "model",
        "The selected runtime has no declared model catalog",
      ),
    );
  const modelDefaults = models.filter((model) => model.isDefault);
  if (new Set(models.map((model) => model.id)).size !== models.length || modelDefaults.length > 1)
    return err(
      new NodeExecutionResolutionError(
        "INVALID_CAPABILITIES",
        "model",
        "Runtime model identifiers and defaults must be unambiguous",
      ),
    );

  // Unbound layers may override one option without discarding an Operation's routing.
  const runtimeLayers = layers.filter(
    (layer) =>
      layer.options.runtimeConfigId === undefined || layer.options.runtimeConfigId === runtime.id,
  );
  const modelSelection = firstOption(runtimeLayers, "model");
  const model =
    modelSelection === undefined
      ? (modelDefaults[0] ?? (models.length === 1 ? models[0] : undefined))
      : models.find((candidate) => candidate.id === modelSelection.value);
  if (model === undefined)
    return err(
      new NodeExecutionResolutionError(
        modelSelection === undefined ? "MODEL_REQUIRED" : "MODEL_UNSUPPORTED",
        "model",
        modelSelection === undefined
          ? "Select a model from the runtime catalog"
          : "The selected runtime does not declare the requested model",
      ),
    );
  const modelLayers = runtimeLayers.filter(
    (layer) => layer.options.model === undefined || layer.options.model === model.id,
  );
  const effort = resolveCapability(model, "reasoningEffort", modelLayers);
  if (effort.isErr()) return err(effort.error);
  const speed = resolveCapability(model, "speed", modelLayers);
  if (speed.isErr()) return err(speed.error);

  origins.runtimeConfigId = runtimeSelection.origin;
  origins.model = modelSelection?.origin ?? "runtime";
  if (effort.value !== undefined) origins.reasoningEffort = effort.value.origin;
  if (speed.value !== undefined) origins.speed = speed.value.origin;

  return parseResolved({
    executorKind: config.executorKind,
    runtimeConfigId: runtime.id,
    agent: runtime.type,
    executablePath: runtime.connection.path,
    model: model.id,
    ...(effort.value === undefined ? {} : { reasoningEffort: effort.value.value }),
    ...(speed.value === undefined ? {} : { speed: speed.value.value }),
    timeouts,
    origins,
  });
};
