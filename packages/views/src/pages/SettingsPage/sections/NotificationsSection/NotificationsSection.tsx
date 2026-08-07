import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import {
  useNotificationStore,
  type NotificationPreference,
} from "../../../../store/notificationStore";
import { SectionHeader } from "../../SectionHeader";
import { Toggle } from "../../Toggle";

const PREFERENCES: NotificationPreference[] = ["done", "failed", "waiting"];

export const NotificationsSection = () => {
  const { t } = useTranslation();
  const store = useNotificationStore();
  const preferences = useStore(store, (state) => state.preferences);
  const setPreference = useStore(store, (state) => state.setPreference);

  return (
    <div className="space-y-5" data-testid="settings-notifications">
      <SectionHeader
        description={t("settings.notifications.description")}
        title={t("settings.notifications.title")}
      />
      <div className="space-y-3">
        {PREFERENCES.map((preference) => {
          const handleToggle = () => setPreference(preference, !preferences[preference]);

          return (
            <div key={preference} data-testid={`settings-notifications-${preference}`}>
              <Toggle
                enabled={preferences[preference]}
                label={t(`settings.notifications.${preference}`)}
                onToggle={handleToggle}
              />
              <p className="px-1 pt-1.5 text-xs text-muted-foreground">
                {t(`settings.notifications.${preference}Hint`)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
