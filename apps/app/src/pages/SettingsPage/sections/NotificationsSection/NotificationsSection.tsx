import { useTranslation } from "react-i18next";
import { SaveButton, SectionHeader, Toggle } from "../../components";

interface NotificationsSectionProps {
  values: { pipeline: boolean; mention: boolean; weekly: boolean };
  onChange: (patch: Partial<{ pipeline: boolean; mention: boolean; weekly: boolean }>) => void;
  onSave: () => void;
  saved: boolean;
}

export const NotificationsSection = ({
  values,
  onChange,
  onSave,
  saved,
}: NotificationsSectionProps) => {
  const { t } = useTranslation();
  const handlePipelineToggle = () => onChange({ pipeline: !values.pipeline });
  const handleMentionToggle = () => onChange({ mention: !values.mention });
  const handleWeeklyToggle = () => onChange({ weekly: !values.weekly });
  const handleSave = onSave;

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
