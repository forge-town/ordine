import { SaveButton, SectionHeader, Toggle } from "../components";

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
  const handlePipelineToggle = () => onChange({ pipeline: !values.pipeline });
  const handleMentionToggle = () => onChange({ mention: !values.mention });
  const handleWeeklyToggle = () => onChange({ weekly: !values.weekly });
  const handleSave = onSave;

  return (
    <>
      <SectionHeader title="通知" description="选择你希望接收哪些通知" />
      <Toggle
        enabled={values.pipeline}
        onToggle={handlePipelineToggle}
        label="Pipeline 运行完成提醒"
      />
      <Toggle enabled={values.mention} onToggle={handleMentionToggle} label="被 @提暂时通知" />
      <Toggle enabled={values.weekly} onToggle={handleWeeklyToggle} label="每周摘要邮件" />
      <SaveButton onSave={handleSave} saved={saved} />
    </>
  );
};
