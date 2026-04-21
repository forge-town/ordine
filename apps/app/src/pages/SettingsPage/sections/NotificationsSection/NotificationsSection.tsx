import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useSettingsStore } from "../../_store";
import { SaveButton } from "../../SaveButton";
import { SectionHeader } from "../../SectionHeader";
import { Toggle } from "../../Toggle";

export const NotificationsSection = () => {
  const { t } = useTranslation();
  const store = useSettingsStore();
  const values = useStore(store, (s) => s.notifications);
  const updateSection = useStore(store, (s) => s.updateSection);
  const save = useStore(store, (s) => s.save);
  const saved = useStore(store, (s) => s.saved);
  const resetSaved = useStore(store, (s) => s.resetSaved);

  const handlePipelineToggle = () => updateSection("notifications", { pipeline: !values.pipeline });
  const handleMentionToggle = () => updateSection("notifications", { mention: !values.mention });
  const handleWeeklyToggle = () => updateSection("notifications", { weekly: !values.weekly });
  const handleSave = () => {
    save();
    setTimeout(resetSaved, 2000);
  };

  return (
    <>
      <SectionHeader
        description={t("settings.notificationsSection.description")}
        title={t("settings.notificationsSection.title")}
      />
      <Toggle
        enabled={values.pipeline}
        label={t("settings.notificationsSection.pipeline")}
        onToggle={handlePipelineToggle}
      />
      <Toggle
        enabled={values.mention}
        label={t("settings.notificationsSection.mention")}
        onToggle={handleMentionToggle}
      />
      <Toggle
        enabled={values.weekly}
        label={t("settings.notificationsSection.weekly")}
        onToggle={handleWeeklyToggle}
      />
      <SaveButton saved={saved} onSave={handleSave} />
    </>
  );
};
