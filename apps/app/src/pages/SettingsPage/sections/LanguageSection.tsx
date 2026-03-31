import { Field, SaveButton, SectionHeader } from "../components";

interface LanguageSectionProps {
  onSave: () => void;
  saved: boolean;
}

export const LanguageSection = ({ onSave, saved }: LanguageSectionProps) => (
  <>
    <SectionHeader title="语言与地区" description="选择界面语言和时区偏好" />
    <Field label="界面语言">
      <select className="rounded-md border bg-muted/30 px-3 py-2 text-sm focus:border-ring focus:outline-none">
        <option value="zh-CN">简体中文</option>
        <option value="en-US">English (US)</option>
        <option value="ja-JP">日本語</option>
      </select>
    </Field>
    <Field label="时区">
      <select className="rounded-md border bg-muted/30 px-3 py-2 text-sm focus:border-ring focus:outline-none">
        <option value="Asia/Shanghai">亚洲 / 上海 (UTC+8)</option>
        <option value="UTC">UTC</option>
        <option value="America/New_York">美洲 / 纽约 (UTC-5)</option>
      </select>
    </Field>
    <SaveButton onSave={onSave} saved={saved} />
  </>
);
