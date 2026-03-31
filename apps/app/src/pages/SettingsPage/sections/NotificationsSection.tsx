import { useState } from "react";
import { SaveButton, SectionHeader, Toggle } from "../components";

interface NotificationsSectionProps {
  onSave: () => void;
  saved: boolean;
}

export const NotificationsSection = ({
  onSave,
  saved,
}: NotificationsSectionProps) => {
  const [toggles, setToggles] = useState({
    pipeline: true,
    mention: true,
    weekly: false,
  });
  const toggle = (k: keyof typeof toggles) =>
    setToggles((p) => ({ ...p, [k]: !p[k] }));

  return (
    <>
      <SectionHeader title="通知" description="选择你希望接收哪些通知" />
      <Toggle
        enabled={toggles.pipeline}
        onToggle={() => toggle("pipeline")}
        label="Pipeline 运行完成提醒"
      />
      <Toggle
        enabled={toggles.mention}
        onToggle={() => toggle("mention")}
        label="被 @提及时通知"
      />
      <Toggle
        enabled={toggles.weekly}
        onToggle={() => toggle("weekly")}
        label="每周摘要邮件"
      />
      <SaveButton onSave={onSave} saved={saved} />
    </>
  );
};
