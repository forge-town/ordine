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
  const handlePipelineToggle = () => onChange({ pipeline: !values.pipeline });
  const handleMentionToggle = () => onChange({ mention: !values.mention });
  const handleWeeklyToggle = () => onChange({ weekly: !values.weekly });
  const handleSave = onSave;

  return (
    <>
      <SectionHeader description="选择你希望接收哪些通知" title="通知" />
      <Toggle
        enabled={values.pipeline}
        label="Pipeline 运行完成提醒"
        onToggle={handlePipelineToggle}
      />
      <Toggle enabled={values.mention} label="被 @提暂时通知" onToggle={handleMentionToggle} />
      <Toggle enabled={values.weekly} label="每周摘要邮件" onToggle={handleWeeklyToggle} />
      <SaveButton saved={saved} onSave={handleSave} />
    </>
  );
};
