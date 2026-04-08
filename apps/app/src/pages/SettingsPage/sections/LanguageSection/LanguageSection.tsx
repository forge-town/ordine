import { useTranslation } from "react-i18next";
import { Field, SaveButton, SectionHeader } from "../../components";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";

interface LanguageSectionProps {
  values: { language: string; timezone: string };
  onChange: (patch: Partial<{ language: string; timezone: string }>) => void;
  onSave: () => void;
  saved: boolean;
}

export const LanguageSection = ({ values, onChange, onSave, saved }: LanguageSectionProps) => {
  const { i18n, t } = useTranslation();
  const handleLanguageChange = (value: string | null) => {
    const lang = value ?? values.language;
    onChange({ language: lang });
    const i18nLang = lang.startsWith("zh") ? "zh" : "en";
    void i18n.changeLanguage(i18nLang);
  };
  const handleTimezoneChange = (value: string | null) =>
    onChange({ timezone: value ?? values.timezone });
  const handleSave = onSave;

  return (
    <>
      <SectionHeader description={t("settings.selectLanguage")} title={t("settings.language")} />
      <Field label={t("settings.language")}>
        <Select value={values.language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="zh-CN">简体中文</SelectItem>
              <SelectItem value="en-US">English (US)</SelectItem>
              <SelectItem value="ja-JP">日本語</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("settings.timezone")}>
        <Select value={values.timezone} onValueChange={handleTimezoneChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="Asia/Shanghai">亚洲 / 上海 (UTC+8)</SelectItem>
              <SelectItem value="UTC">UTC</SelectItem>
              <SelectItem value="America/New_York">美洲 / 纽约 (UTC-5)</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <SaveButton saved={saved} onSave={handleSave} />
    </>
  );
};
