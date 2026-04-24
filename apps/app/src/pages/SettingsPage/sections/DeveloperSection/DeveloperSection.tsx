import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOne, useUpdate } from "@refinedev/core";
import { Input } from "@repo/ui/input";
import { AgentRuntimeSchema, type AgentRuntime, type Settings } from "@repo/schemas";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { Field } from "../../Field";
import { SaveButton } from "../../SaveButton";
import { SectionHeader } from "../../SectionHeader";

const AGENT_RUNTIME_OPTIONS = AgentRuntimeSchema.options;

export const DeveloperSection = () => {
  const { t } = useTranslation();
  const { result: settingsResult, query: settingsQuery } = useOne<Settings>({
    resource: "settings",
    id: "default",
  });
  const { mutateAsync: updateSettings } = useUpdate();
  const [defaultAgentRuntime, setDefaultAgentRuntime] = useState<AgentRuntime | null>(null);
  const [defaultOutputPath, setDefaultOutputPath] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const currentAgentRuntime =
    defaultAgentRuntime ?? settingsResult?.defaultAgentRuntime ?? AGENT_RUNTIME_OPTIONS[0];
  const currentPath = defaultOutputPath ?? settingsResult?.defaultOutputPath ?? "";

  const handleAgentRuntimeChange = useCallback((value: AgentRuntime | null) => {
    if (!value) return;

    setDefaultAgentRuntime(value);
  }, []);

  const handlePathChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDefaultOutputPath(e.target.value);
  }, []);

  const handleSave = useCallback(async () => {
    await updateSettings({
      resource: "settings",
      id: "default",
      values: {
        defaultAgentRuntime: currentAgentRuntime,
        defaultOutputPath: currentPath,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [currentAgentRuntime, currentPath, updateSettings]);

  if (settingsQuery.isLoading) return null;

  return (
    <>
      <SectionHeader
        description={t("settings.developerSection.description")}
        title={t("settings.developerSection.title")}
      />
      <Field label={t("settings.developerSection.defaultAgentRuntime")}>
        <Select value={currentAgentRuntime} onValueChange={handleAgentRuntimeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {AGENT_RUNTIME_OPTIONS.map((runtime) => (
                <SelectItem key={runtime} value={runtime}>
                  {runtime}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("settings.developerSection.defaultOutputPath")}>
        <Input placeholder="/home/user/projects/" value={currentPath} onChange={handlePathChange} />
      </Field>
      <SaveButton saved={saved} onSave={handleSave} />
    </>
  );
};
