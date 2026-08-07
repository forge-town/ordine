import { useEffect, useState, type ChangeEvent } from "react";
import { useList, useOne, useUpdate } from "@refinedev/core";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentRuntimeConfig, Settings } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { ResourceName } from "../../../../constants";
import { toastStore } from "../../../../store/toastStore";
import { SectionHeader } from "../../SectionHeader";

export const DefaultsSection = () => {
  const { t } = useTranslation();
  const { result: settings } = useOne<Settings>({
    id: "default",
    resource: ResourceName.settings,
  });
  const { result: runtimesResult } = useList<AgentRuntimeConfig>({
    resource: ResourceName.agentRuntimes,
  });
  const { mutate: updateSettings } = useUpdate();
  const [draft, setDraft] = useState<Partial<Settings>>({});
  const [keyShown, setKeyShown] = useState(false);

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const patch = (values: Partial<Settings>) => setDraft((state) => ({ ...state, ...values }));
  const detectedRuntimes = runtimesResult.data;
  const savedRuntime = draft.defaultAgentRuntime;
  const runtimeInvalid =
    Boolean(savedRuntime) &&
    detectedRuntimes.length > 0 &&
    !detectedRuntimes.some((runtime) => runtime.type === savedRuntime);
  const firstDetected = detectedRuntimes[0];
  const handleRuntimeChange = (value: string | null) => {
    if (value) patch({ defaultAgentRuntime: value as Settings["defaultAgentRuntime"] });
  };
  const handleModelChange = (event: ChangeEvent<HTMLInputElement>) =>
    patch({ defaultModel: event.target.value });
  const handleApiKeyChange = (event: ChangeEvent<HTMLInputElement>) =>
    patch({ defaultApiKey: event.target.value });
  const handleOutputPathChange = (event: ChangeEvent<HTMLInputElement>) =>
    patch({ defaultOutputPath: event.target.value });
  const handleToggleKeyVisibility = () => setKeyShown((value) => !value);

  const handleFixRuntime = () => {
    if (!firstDetected) return;

    patch({ defaultAgentRuntime: firstDetected.type as Settings["defaultAgentRuntime"] });
    updateSettings(
      {
        errorNotification: false,
        id: "default",
        resource: ResourceName.settings,
        successNotification: false,
        values: { defaultAgentRuntime: firstDetected.type },
      },
      {
        onSuccess: () =>
          toastStore.getState().addToast({
            title: t("settings.defaults.runtimeFixed", { name: firstDetected.name }),
            type: "success",
          }),
      },
    );
  };

  const handleSave = () => {
    updateSettings(
      {
        errorNotification: false,
        id: "default",
        resource: ResourceName.settings,
        successNotification: false,
        values: {
          defaultAgentRuntime: draft.defaultAgentRuntime,
          defaultApiKey: draft.defaultApiKey,
          defaultModel: draft.defaultModel,
          defaultOutputPath: draft.defaultOutputPath,
        },
      },
      {
        onError: () =>
          toastStore.getState().addToast({
            title: t("settings.defaults.saveFailed"),
            type: "error",
          }),
        onSuccess: () =>
          toastStore.getState().addToast({
            title: t("settings.defaults.saved"),
            type: "success",
          }),
      },
    );
  };

  return (
    <div className="space-y-5" data-testid="settings-defaults">
      <SectionHeader
        description={t("settings.defaults.description")}
        title={t("settings.defaults.title")}
      />
      <div className="space-y-1.5">
        <Label>{t("settings.defaults.runtime")}</Label>
        <Select value={draft.defaultAgentRuntime ?? ""} onValueChange={handleRuntimeChange}>
          <SelectTrigger data-testid="settings-default-runtime">
            <SelectValue>{draft.defaultAgentRuntime ?? "-"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {detectedRuntimes.map((runtime) => (
              <SelectItem key={runtime.id} value={runtime.type}>
                {runtime.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {runtimeInvalid ? (
          <div
            className="flex items-center gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
            data-testid="settings-runtime-invalid"
          >
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">
              {t("settings.defaults.runtimeInvalid", { value: savedRuntime })}
            </span>
            {firstDetected ? (
              <Button
                className="h-7 shrink-0 rounded-md px-2 text-xs"
                data-testid="settings-runtime-fix"
                size="sm"
                type="button"
                variant="outline"
                onClick={handleFixRuntime}
              >
                {t("settings.defaults.runtimeFix", { name: firstDetected.name })}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="settings-default-model">{t("settings.defaults.model")}</Label>
        <Input
          data-testid="settings-default-model"
          id="settings-default-model"
          value={draft.defaultModel ?? ""}
          onChange={handleModelChange}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="settings-default-api-key">{t("settings.defaults.apiKey")}</Label>
        <div className="flex items-center gap-1.5">
          <Input
            className="font-mono"
            data-testid="settings-default-api-key"
            id="settings-default-api-key"
            type={keyShown ? "text" : "password"}
            value={draft.defaultApiKey ?? ""}
            onChange={handleApiKeyChange}
          />
          <Button
            aria-label={t("settings.defaults.toggleKey")}
            className="shrink-0"
            size="icon"
            type="button"
            variant="ghost"
            onClick={handleToggleKeyVisibility}
          >
            {keyShown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("settings.defaults.apiKeyHint")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="settings-default-output">{t("settings.defaults.outputPath")}</Label>
        <Input
          className="font-mono"
          data-testid="settings-default-output"
          id="settings-default-output"
          value={draft.defaultOutputPath ?? ""}
          onChange={handleOutputPathChange}
        />
      </div>
      <Button data-testid="settings-defaults-save" type="button" onClick={handleSave}>
        {t("settings.defaults.save")}
      </Button>
    </div>
  );
};
