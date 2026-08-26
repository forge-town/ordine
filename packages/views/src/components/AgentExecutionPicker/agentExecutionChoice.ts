import type {
  AgentExecutionChoice,
  AgentRuntimeCatalogEntry,
  AgentRuntimePreference,
  Settings,
} from "@repo/schemas";

export const runtimeCatalogEntryIsSelectable = (entry: AgentRuntimeCatalogEntry): boolean =>
  entry.compatibility.supportLevel === "supported" &&
  entry.availability === "launchable" &&
  entry.runtimeConfigId !== null;

export const DEFAULT_FIRST_OUTPUT_TIMEOUT_SECONDS = 45;

const defaultModelId = (entry: AgentRuntimeCatalogEntry): string | undefined =>
  entry.models.find((model) => model.isDefault)?.id ?? entry.models[0]?.id;

const catalogContainsModel = (entry: AgentRuntimeCatalogEntry, model: string): boolean =>
  entry.models.some((candidate) => candidate.id === model);

export const executionChoiceForRuntime = (
  entry: AgentRuntimeCatalogEntry,
  preference?: AgentRuntimePreference,
  legacyDefaultModel?: string,
): AgentExecutionChoice | null => {
  if (!entry.runtimeConfigId) return null;
  const legacyModel = legacyDefaultModel?.trim();
  const model =
    preference?.model ||
    (legacyModel && catalogContainsModel(entry, legacyModel) ? legacyModel : undefined) ||
    defaultModelId(entry);
  const selectedModel = entry.models.find((candidate) => candidate.id === model);
  const reasoningEffort = preference?.reasoningEffort ?? selectedModel?.defaultReasoningEffort;
  const speed = preference?.speed ?? selectedModel?.defaultSpeed;
  const firstOutputTimeoutSeconds =
    preference?.firstOutputTimeoutSeconds ?? DEFAULT_FIRST_OUTPUT_TIMEOUT_SECONDS;

  return {
    runtimeConfigId: entry.runtimeConfigId,
    ...(model ? { model } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
    ...(speed ? { speed } : {}),
    firstOutputTimeoutSeconds,
  };
};

export const resolveAgentExecutionChoice = (
  catalog: AgentRuntimeCatalogEntry[],
  settings: Settings | undefined,
  requestedRuntimeConfigId?: string | null,
): AgentExecutionChoice | null => {
  const selectable = catalog.filter(runtimeCatalogEntryIsSelectable);
  const entry =
    selectable.find((candidate) => candidate.runtimeConfigId === requestedRuntimeConfigId) ??
    selectable.find(
      (candidate) => candidate.runtimeConfigId === settings?.defaultAgentRuntimeConfigId,
    ) ??
    selectable.find((candidate) => candidate.runtime === settings?.defaultAgentRuntime) ??
    selectable[0];
  if (!entry) return null;

  return executionChoiceForRuntime(
    entry,
    settings?.agentRuntimePreferences?.[entry.runtimeConfigId ?? ""],
    settings?.defaultModel,
  );
};

export const changeExecutionRuntime = (
  catalog: AgentRuntimeCatalogEntry[],
  settings: Settings | undefined,
  runtimeConfigId: string,
): AgentExecutionChoice | null => {
  const entry = catalog.find((candidate) => candidate.runtimeConfigId === runtimeConfigId);
  if (!entry || !runtimeCatalogEntryIsSelectable(entry)) return null;

  return executionChoiceForRuntime(
    entry,
    settings?.agentRuntimePreferences?.[runtimeConfigId],
    entry.runtime === settings?.defaultAgentRuntime ? settings.defaultModel : undefined,
  );
};

export const changeExecutionModel = (
  entry: AgentRuntimeCatalogEntry,
  choice: AgentExecutionChoice,
  model: string,
): AgentExecutionChoice => {
  const selectedModel = entry.models.find((candidate) => candidate.id === model);

  return {
    runtimeConfigId: choice.runtimeConfigId,
    model,
    ...(selectedModel?.defaultReasoningEffort
      ? { reasoningEffort: selectedModel.defaultReasoningEffort }
      : {}),
    ...(selectedModel?.defaultSpeed ? { speed: selectedModel.defaultSpeed } : {}),
    ...(choice.firstOutputTimeoutSeconds === undefined
      ? {}
      : { firstOutputTimeoutSeconds: choice.firstOutputTimeoutSeconds }),
  };
};
