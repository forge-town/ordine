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
import { getAgentRuntimeCatalogData } from "./agentRuntimeCatalogData";

interface UseAgentExecutionChoiceOptions {
  requestedRuntimeConfigId?: string | null;
}

export const useAgentExecutionChoice = ({
  requestedRuntimeConfigId,
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
  const preferencesRef = useRef<AgentRuntimePreferences>({});
  const catalog = useMemo(
    () => getAgentRuntimeCatalogData(catalogResult?.data),
    [catalogResult?.data],
  );
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
  const choice =
    localChoice && localEntry && runtimeCatalogEntryIsSelectable(localEntry)
      ? localChoice
      : persistedChoice;

  const persistChoice = useCallback(
    (nextChoice: AgentExecutionChoice) => {
      const entry = catalog.find(
        (candidate) => candidate.runtimeConfigId === nextChoice.runtimeConfigId,
      );
      if (!entry || !runtimeCatalogEntryIsSelectable(entry)) return;
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
      setLocalChoice(nextChoice);
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
    [catalog, settings, updateSettings],
  );

  const selectRuntime = useCallback(
    (runtimeConfigId: string) => {
      const nextChoice = changeExecutionRuntime(catalog, settings, runtimeConfigId);
      if (nextChoice) persistChoice(nextChoice);
    },
    [catalog, persistChoice, settings],
  );

  return {
    catalog,
    catalogQuery,
    choice,
    isLoading: catalogQuery.isLoading || settingsQuery.isLoading,
    isSaving: updateMutation.isPending,
    persistChoice,
    selectRuntime,
    settings,
  };
};
