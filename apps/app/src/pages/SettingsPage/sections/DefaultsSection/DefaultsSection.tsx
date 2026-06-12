import { useEffect, useState } from "react";
import { useList, useOne, useUpdate } from "@refinedev/core";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentRuntimeConfig, Settings } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { toastStore } from "@/store/toastStore";
import { SectionHeader } from "../../SectionHeader";

/** What the Agent Bar reaches for first when assembling an executor. */
export const DefaultsSection = () => {
  const { t } = useTranslation();
  const { result: settings } = useOne<Settings>({
    id: "settings",
    resource: ResourceName.settings,
  });
  const { result: runtimesResult } = useList<AgentRuntimeConfig>({
    resource: ResourceName.agentRuntimes,
  });
  const { mutate: updateSettings } = useUpdate();
  const [draft, setDraft] = useState<Partial<Settings>>({});
  const [keyShown, setKeyShown] = useState(false);

  useEffect(() => {
    if (settings) {
      setDraft(settings);
    }
  }, [settings]);

  const patch = (values: Partial<Settings>) => setDraft((state) => ({ ...state, ...values }));

  // N18-03（N11 期末缺陷 2 根治）：保存的默认 runtime 不在检测列表时显式警告，
  // 否则 Agent Bar 会带着失效 runtime 全部秒败且无任何提示。
  const detectedRuntimes = runtimesResult.data;
  const savedRuntime = draft.defaultAgentRuntime;
  const runtimeInvalid =
    Boolean(savedRuntime) &&
    detectedRuntimes.length > 0 &&
    !detectedRuntimes.some((runtime) => runtime.type === savedRuntime);
  const firstDetected = detectedRuntimes[0];
  const handleFixRuntime = () => {
    if (!firstDetected) {
      return;
    }
    patch({ defaultAgentRuntime: firstDetected.type as Settings["defaultAgentRuntime"] });
    updateSettings(
      {
        errorNotification: false,
        id: "settings",
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
        id: "settings",
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
        <Select
          value={draft.defaultAgentRuntime ?? ""}
          onValueChange={(value) =>
            value && patch({ defaultAgentRuntime: value as Settings["defaultAgentRuntime"] })
          }
        >
          <SelectTrigger data-testid="settings-default-runtime">
            <SelectValue>{draft.defaultAgentRuntime ?? "-"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {runtimesResult.data.map((runtime) => (
              <SelectItem key={runtime.id} value={runtime.type}>
                {runtime.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {runtimeInvalid ? (
          <div
            className="flex items-center gap-2 rounded-lg bg-destructive/10 px-2.5 py-2 text-[11.5px] text-destructive"
            data-testid="settings-runtime-invalid"
          >
            <TriangleAlert className="size-3.5 shrink-0" />
            <span className="flex-1">
              {t("settings.defaults.runtimeInvalid", { value: savedRuntime })}
            </span>
            {firstDetected ? (
              <Button
                className="h-6 shrink-0 rounded-lg px-2 text-[11px]"
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
          onChange={(event) => patch({ defaultModel: event.target.value })}
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
            onChange={(event) => patch({ defaultApiKey: event.target.value })}
          />
          <Button
            aria-label={t("settings.defaults.toggleKey")}
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => setKeyShown((value) => !value)}
          >
            {keyShown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("settings.defaults.apiKeyHint")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="settings-default-output">{t("settings.defaults.outputPath")}</Label>
        <Input
          className="font-mono"
          data-testid="settings-default-output"
          id="settings-default-output"
          value={draft.defaultOutputPath ?? ""}
          onChange={(event) => patch({ defaultOutputPath: event.target.value })}
        />
      </div>
      <Button data-testid="settings-defaults-save" onClick={handleSave}>
        {t("settings.defaults.save")}
      </Button>
    </div>
  );
};
