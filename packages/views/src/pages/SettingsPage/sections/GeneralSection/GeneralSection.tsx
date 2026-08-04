import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import {
  useNotificationStore,
  type NotificationPreference,
} from "../../../../store/notificationStore";
import { useThemeStore, type ThemePreference } from "../../../../store/themeStore";
import { SectionHeader } from "../../SectionHeader";
import { Toggle } from "../../Toggle";

const THEMES: Array<{ value: ThemePreference; icon: typeof Sun }> = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

const NOTIFICATION_PREFERENCES: NotificationPreference[] = ["done", "failed", "waiting"];

export const GeneralSection = () => {
  const { t } = useTranslation();
  const themeStore = useThemeStore();
  const preference = useStore(themeStore, (state) => state.preference);
  const setPreference = useStore(themeStore, (state) => state.setPreference);
  const notificationStore = useNotificationStore();
  const notificationPreferences = useStore(notificationStore, (state) => state.preferences);
  const setNotificationPreference = useStore(notificationStore, (state) => state.setPreference);

  return (
    <div className="space-y-8">
      <section>
        <SectionHeader
          description={t("settings.general.appearance.description")}
          title={t("settings.general.appearance.title")}
        />
        <div
          aria-label={t("settings.general.appearance.title")}
          className="grid grid-cols-3 gap-2"
          role="group"
        >
          {THEMES.map(({ value, icon: Icon }) => {
            const handleThemeClick = () => setPreference(value);

            return (
              <Button
                key={value}
                aria-pressed={preference === value}
                className={cn("h-10 gap-2", preference === value && "border-primary")}
                type="button"
                variant={preference === value ? "secondary" : "outline"}
                onClick={handleThemeClick}
              >
                <Icon className="h-4 w-4" />
                {t(`settings.general.appearance.${value}`)}
              </Button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader
          description={t("settings.general.notifications.description")}
          title={t("settings.general.notifications.title")}
        />
        <div className="space-y-2">
          {NOTIFICATION_PREFERENCES.map((item) => {
            const handleNotificationToggle = () =>
              setNotificationPreference(item, !notificationPreferences[item]);

            return (
              <Toggle
                key={item}
                enabled={notificationPreferences[item]}
                label={t(`settings.general.notifications.${item}`)}
                onToggle={handleNotificationToggle}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
};
