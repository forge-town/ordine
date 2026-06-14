import { useTranslation } from "react-i18next";
import {
  useNotificationPrefsStore,
  type NotificationPrefKey,
} from "@/store/notificationStore/notificationPrefsStore";
import { SectionHeader } from "../../SectionHeader";
import { Toggle } from "../../Toggle";

const PREF_KEYS: NotificationPrefKey[] = ["done", "failed", "waiting"];

/**
 * N18-04：通知偏好（原型 Notifications 组）。开关即时生效并持久化；
 * 事件派发通道见 useRunPolling（G3-06），此处只管偏好。
 */
export const NotificationsSection = () => {
  const { t } = useTranslation();
  const prefs = useNotificationPrefsStore();

  return (
    <div className="space-y-5" data-testid="settings-notifications">
      <SectionHeader
        description={t("settings.notifications.description")}
        title={t("settings.notifications.title")}
      />
      <div className="space-y-2">
        {PREF_KEYS.map((key) => (
          <div key={key} data-testid={`settings-notifications-${key}`}>
            <Toggle
              enabled={prefs[key]}
              label={t(`settings.notifications.${key}`)}
              onToggle={() => prefs.setPref(key, !prefs[key])}
            />
            <p className="px-1 pt-1 text-[11px] text-muted-foreground">
              {t(`settings.notifications.${key}Hint`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
