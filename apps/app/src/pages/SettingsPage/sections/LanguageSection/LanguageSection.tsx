import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useSettingsStore } from "../../_store";
import { Field } from "../../Field";
import { SaveButton } from "../../SaveButton";
import { SectionHeader } from "../../SectionHeader";
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
    setLanguageOpen(false);
  };
  const handleTimezoneChange = (value: string | null) => {
    updateSection("language", { timezone: value ?? values.timezone });
    setTimezoneOpen(false);
  };

  const [languageOpen, setLanguageOpen] = useState(false);
  const handleLanguageOpenChange = (v: boolean) => setLanguageOpen(v);
  const handleLanguageToggle = () => setLanguageOpen((prev) => !prev);

  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const handleTimezoneOpenChange = (v: boolean) => setTimezoneOpen(v);
  const handleTimezoneToggle = () => setTimezoneOpen((prev) => !prev);
  const handleSave = () => {
    save();
    setTimeout(resetSaved, 2000);
  };

  return (
    <>
      <SectionHeader description={t("settings.selectLanguage")} title={t("settings.language")} />
      <Field label={t("settings.language")}>
        <Select
          open={languageOpen}
          value={values.language}
          onOpenChange={handleLanguageOpenChange}
          onValueChange={handleLanguageChange}
        >
          <SelectTrigger className="w-48" onClick={handleLanguageToggle}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="zh-CN">简体中文</SelectItem>
              <SelectItem value="en-US">English (US)</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("settings.timezone")}>
        <Select
          open={timezoneOpen}
          value={values.timezone}
          onOpenChange={handleTimezoneOpenChange}
          onValueChange={handleTimezoneChange}
        >
          <SelectTrigger className="w-48" onClick={handleTimezoneToggle}>
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
