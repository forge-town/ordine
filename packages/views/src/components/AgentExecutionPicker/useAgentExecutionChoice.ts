import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCustom, useOne, useUpdate } from "@refinedev/core";
import type {
  AgentExecutionChoice,
  AgentRuntimeCatalogEntry,
  AgentRuntimePreference,
  AgentRuntimePreferences,
  Settings,
} from "@repo/schemas";
import { ResourceName } from "../../constants";
import {
  changeExecutionRuntime,
  resolveAgentExecutionChoice,
  runtimeCatalogEntryIsSelectable,
} from "./agentExecutionChoice";
import {
  readAgentRuntimeCatalogCache,
  writeAgentRuntimeCatalogCache,
} from "./agentRuntimeCatalogCache";
import { getAgentRuntimeCatalogData } from "./agentRuntimeCatalogData";

interface UseAgentExecutionChoiceOptions {
  requestedRuntimeConfigId?: string | null;
  scope?: "session" | "run";
  runScopeId?: string | null;
}

export const useAgentExecutionChoice = ({
  requestedRuntimeConfigId,
  scope = "session",
  runScopeId = null,
}: UseAgentExecutionChoiceOptions = {}) => {
  const { result: catalogResult, query: catalogQuery } = useCustom<AgentRuntimeCatalogEntry[]>({
    method: "get",
    url: "agentRuntimes/getCatalog",
  });
  const { result: settings, query: settingsQuery } = useOne<Settings>({
    id: "default",
    resource: ResourceName.settings,
  });
  const { mutate: updateSettings, mutation: updateMutation } = useUpdate();
  const [localChoice, setLocalChoice] = useState<AgentExecutionChoice | null>(null);
  const [localRunScopeId, setLocalRunScopeId] = useState<string | null>(null);
  const [runSelection, setRunSelection] = useState<{
    scopeId: string | null;
    overrides: Partial<AgentExecutionChoice>;
  } | null>(null);
  const [cachedCatalog] = useState(readAgentRuntimeCatalogCache);
  const preferencesRef = useRef<AgentRuntimePreferences>({});
  const liveCatalog = useMemo(
    () => getAgentRuntimeCatalogData(catalogResult?.data),
    [catalogResult?.data],
  );
  const hasLiveCatalog = catalogResult?.data !== undefined;
  const catalog = hasLiveCatalog ? liveCatalog : cachedCatalog;
  useEffect(() => {
    if (hasLiveCatalog) writeAgentRuntimeCatalogCache(liveCatalog);
  }, [hasLiveCatalog, liveCatalog]);
  useEffect(() => {
    if (!updateMutation.isPending) {
      preferencesRef.current = settings?.agentRuntimePreferences ?? {};
    }
  }, [settings?.agentRuntimePreferences, updateMutation.isPending]);
  const persistedChoice = useMemo(
    () => resolveAgentExecutionChoice(catalog, settings, requestedRuntimeConfigId),
    [catalog, requestedRuntimeConfigId, settings],
  );
  const localEntry = catalog.find(
    (entry) => entry.runtimeConfigId === localChoice?.runtimeConfigId,
  );
  const explicitChoice =
    localChoice &&
    localEntry &&
    runtimeCatalogEntryIsSelectable(localEntry) &&
    (scope !== "run" || localRunScopeId === runScopeId)
      ? localChoice
      : null;
  const explicitOverrides =
    scope === "run" && runSelection?.scopeId === runScopeId ? runSelection.overrides : null;
  const displayedChoice = explicitChoice ?? persistedChoice;
  const choice =
    displayedChoice && explicitOverrides
      ? { ...displayedChoice, ...explicitOverrides }
      : displayedChoice;

  const persistChoice = useCallback(
    (nextChoice: AgentExecutionChoice, changedFields?: Array<keyof AgentExecutionChoice>) => {
      const entry = catalog.find(
        (candidate) => candidate.runtimeConfigId === nextChoice.runtimeConfigId,
      );
      if (!entry || !runtimeCatalogEntryIsSelectable(entry)) return;
      setLocalChoice(nextChoice);
      setLocalRunScopeId(runScopeId);
      if (scope === "run") {
        const fields =
          changedFields ?? (Object.keys(nextChoice) as Array<keyof AgentExecutionChoice>);
        const patch = Object.fromEntries(
          fields
            .filter((field) => nextChoice[field] !== undefined)
            .map((field) => [field, nextChoice[field]]),
        );
        setRunSelection((current) => ({
          scopeId: runScopeId,
          overrides: { ...(current?.scopeId === runScopeId ? current.overrides : {}), ...patch },
        }));

        return;
      }
      const preference: AgentRuntimePreference = {
        ...(nextChoice.model ? { model: nextChoice.model } : {}),
        ...(nextChoice.reasoningEffort ? { reasoningEffort: nextChoice.reasoningEffort } : {}),
        ...(nextChoice.speed ? { speed: nextChoice.speed } : {}),
        ...(nextChoice.firstOutputTimeoutSeconds === undefined
          ? {}
          : { firstOutputTimeoutSeconds: nextChoice.firstOutputTimeoutSeconds }),
      };
      const nextPreferences = {
        ...preferencesRef.current,
        [nextChoice.runtimeConfigId]: preference,
      };
      preferencesRef.current = nextPreferences;
      updateSettings(
        {
          errorNotification: false,
          id: "default",
          resource: ResourceName.settings,
          successNotification: false,
          values: {
            defaultAgentRuntime: entry.runtime,
            defaultAgentRuntimeConfigId: nextChoice.runtimeConfigId,
            defaultModel: nextChoice.model ?? settings?.defaultModel ?? "",
            agentRuntimePreferences: nextPreferences,
          },
        },
        {
          onError: () => {
            preferencesRef.current = settings?.agentRuntimePreferences ?? {};
            setLocalChoice(null);
          },
        },
      );
    },
    [catalog, runScopeId, scope, settings, updateSettings],
  );

  const selectRuntime = useCallback(
    (runtimeConfigId: string) => {
      const nextChoice = changeExecutionRuntime(catalog, settings, runtimeConfigId);
      if (nextChoice) persistChoice(nextChoice, ["runtimeConfigId"]);
    },
    [catalog, persistChoice, settings],
  );

  return {
    catalog,
    catalogQuery,
    choice,
    explicitChoice,
    explicitOverrides,
    isLoading: (catalog.length === 0 && catalogQuery.isLoading) || settingsQuery.isLoading,
    isSaving: scope === "session" && updateMutation.isPending,
    persistChoice,
    selectRuntime,
    settings,
  };
};
