import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOne, useUpdate } from "@refinedev/core";
import { Input } from "@repo/ui/input";
import type { SettingsRecord } from "@repo/db-schema";
import { Field } from "../../Field";
import { SaveButton } from "../../SaveButton";
import { SectionHeader } from "../../SectionHeader";

export const DeveloperSection = () => {
  const { t } = useTranslation();
  const { result: settingsResult, query: settingsQuery } = useOne<SettingsRecord>({
    resource: "settings",
    id: "default",
  });
  const { mutateAsync: updateSettings } = useUpdate();
  const [defaultOutputPath, setDefaultOutputPath] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const currentPath = defaultOutputPath ?? settingsResult?.defaultOutputPath ?? "";

  const handlePathChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDefaultOutputPath(e.target.value);
  }, []);

  const handleSave = useCallback(async () => {
    await updateSettings({
      resource: "settings",
      id: "default",
      values: { defaultOutputPath: currentPath },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [currentPath, updateSettings]);

  if (settingsQuery.isLoading) return null;

  return (
    <>
      <SectionHeader
        description={t("settings.developerSection.description")}
        title={t("settings.developerSection.title")}
      />
      <Field label={t("settings.developerSection.defaultOutputPath")}>
        <Input placeholder="/home/user/projects/" value={currentPath} onChange={handlePathChange} />
      </Field>
      <SaveButton saved={saved} onSave={handleSave} />
    </>
  );
};
