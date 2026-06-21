import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { useStore } from "zustand";
import { useSettingsPageStore } from "../../_store";
import { useThemeStore, type ThemePreference } from "@/store/themeStore";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { SaveButton } from "../../SaveButton";
import { SectionHeader } from "../../SectionHeader";

const SAVED_INDICATOR_MS = 2000;

const languageSchema = z.object({
  language: z.string(),
  timezone: z.string(),
});

type LanguageFormValues = z.infer<typeof languageSchema>;

const THEME_OPTIONS: ThemePreference[] = ["light", "dark", "system"];

export const LanguageSection = () => {
  const { i18n, t } = useTranslation();
  const themePreference = useThemeStore((state) => state.preference);
  const setThemePreference = useThemeStore((state) => state.setPreference);
  const store = useSettingsPageStore();
  const values = useStore(store, (s) => s.language);
  const updateSection = useStore(store, (s) => s.updateSection);
  const save = useStore(store, (s) => s.save);
  const [saved, setSaved] = useState(false);

  const form = useForm<LanguageFormValues>({
    resolver: zodResolver(languageSchema),
    defaultValues: {
      language: values.language,
      timezone: values.timezone,
    },
  });

  const handleSubmit = (formValues: LanguageFormValues) => {
    updateSection("language", formValues);
    const i18nLang = formValues.language.startsWith("zh") ? "zh" : "en";
    void i18n.changeLanguage(i18nLang);
    save();
    setSaved(true);
    setTimeout(() => setSaved(false), SAVED_INDICATOR_MS);
  };

  return (
    <Form {...form}>
      <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <SectionHeader description={t("settings.selectLanguage")} title={t("settings.language")} />
        <FormField
          control={form.control}
          name="language"
          render={({ field }) => {
            const handleValueChange = (value: string | null) => {
              if (value) field.onChange(value);
            };

            return (
              <FormItem>
                <FormLabel>{t("settings.language")}</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={handleValueChange}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="zh-CN">简体中文</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        {/* N18-02：外观切换（原型 General 组）——立即生效并持久化，无需保存。 */}
        <div className="space-y-2">
          <FormLabel>{t("settings.appearance.label")}</FormLabel>
          <div
            className="flex w-fit gap-1 rounded-xl bg-surface-2 p-1"
            data-testid="settings-appearance"
          >
            {THEME_OPTIONS.map((option) => (
              <button
                key={option}
                className={
                  themePreference === option
                    ? "rounded-lg bg-surface px-3 py-1.5 text-[12px] font-medium text-foreground shadow-soft ring-1 ring-border"
                    : "rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                }
                data-testid={`settings-appearance-${option}`}
                type="button"
                onClick={() => setThemePreference(option)}
              >
                {t(`settings.appearance.${option}`)}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{t("settings.appearance.hint")}</p>
        </div>
        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => {
            const handleValueChange = (value: string | null) => {
              if (value) field.onChange(value);
            };

            return (
              <FormItem>
                <FormLabel>{t("settings.timezone")}</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={handleValueChange}>
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
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        <SaveButton saved={saved} onSave={form.handleSubmit(handleSubmit)} />
      </form>
    </Form>
  );
};
