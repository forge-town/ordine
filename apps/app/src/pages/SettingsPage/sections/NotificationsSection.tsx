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
  return (
    <>
      <SectionHeader title="通知" description="选择你希望接收哪些通知" />
      <Toggle
        enabled={values.pipeline}
        onToggle={() => onChange({ pipeline: !values.pipeline })}
        label="Pipeline 运行完成提醒"
      />
      <Toggle
        enabled={values.mention}
        onToggle={() => onChange({ mention: !values.mention })}
        label="被 @提及时通知"
      />
      <Toggle
        enabled={values.weekly}
        onToggle={() => onChange({ weekly: !values.weekly })}
        label="每周摘要邮件"
      />
      <SaveButton onSave={onSave} saved={saved} />
    </>
  );
};
