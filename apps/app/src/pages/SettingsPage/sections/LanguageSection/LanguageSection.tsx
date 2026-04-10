import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useSettingsStore } from "../../_store";
import { Field, SaveButton, SectionHeader } from "../../components";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";

export const LanguageSection = () => {
  const { i18n, t } = useTranslation();
  const store = useSettingsStore();
  const values = useStore(store, (s) => s.language);
  const updateSection = useStore(store, (s) => s.updateSection);
  const save = useStore(store, (s) => s.save);
  const saved = useStore(store, (s) => s.saved);
  const resetSaved = useStore(store, (s) => s.resetSaved);

  const handleLanguageChange = (value: string | null) => {
    const lang = value ?? values.language;
    updateSection("language", { language: lang });
    const i18nLang = lang.startsWith("zh") ? "zh" : "en";
    void i18n.changeLanguage(i18nLang);
  };
  const handleTimezoneChange = (value: string | null) =>
    updateSection("language", { timezone: value ?? values.timezone });
  const handleSave = () => {
    save();
    setTimeout(resetSaved, 2000);
  };

  return (
    <>
      <SectionHeader
        description={t("settings.selectLanguage")}
        title={t("settings.language")}
      />
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
              <SelectItem value="America/New_York">
                美洲 / 纽约 (UTC-5)
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <SaveButton saved={saved} onSave={handleSave} />
    </>
  );
};
