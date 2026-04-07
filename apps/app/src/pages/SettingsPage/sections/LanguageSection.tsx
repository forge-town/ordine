import { Field, SaveButton, SectionHeader } from "../components";

interface LanguageSectionProps {
  values: { language: string; timezone: string };
  onChange: (patch: Partial<{ language: string; timezone: string }>) => void;
  onSave: () => void;
  saved: boolean;
}

export const LanguageSection = ({
  values,
  onChange,
  onSave,
  saved,
}: LanguageSectionProps) => {
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ language: e.target.value });
  const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ timezone: e.target.value });
  const handleSave = onSave;

  return (
    <>
      <SectionHeader title="语言与地区" description="选择界面语言和时区偏好" />
      <Field label="界面语言">
        <select
          value={values.language}
          onChange={handleLanguageChange}
          className="rounded-md border bg-muted/30 px-3 py-2 text-sm focus:border-ring focus:outline-none"
        >
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English (US)</option>
          <option value="ja-JP">日本語</option>
        </select>
      </Field>
      <Field label="时区">
        <select
          value={values.timezone}
          onChange={handleTimezoneChange}
          className="rounded-md border bg-muted/30 px-3 py-2 text-sm focus:border-ring focus:outline-none"
        >
          <option value="Asia/Shanghai">亚洲 / 上海 (UTC+8)</option>
          <option value="UTC">UTC</option>
          <option value="America/New_York">美洲 / 纽约 (UTC-5)</option>
        </select>
      </Field>
      <SaveButton onSave={handleSave} saved={saved} />
    </>
  );
};
