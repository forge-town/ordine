import { useState, useEffect, useCallback } from "react";
import { User, Bell, Palette, Globe, Shield, ChevronRight } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import {
  AppearanceSection,
  LanguageSection,
  NotificationsSection,
  ProfileSection,
  SecuritySection,
} from "../sections";

type Section = "profile" | "notifications" | "appearance" | "language" | "security";

const sections: {
  id: Section;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: "profile", label: "个人信息", icon: User },
  { id: "notifications", label: "通知", icon: Bell },
  { id: "appearance", label: "外观", icon: Palette },
  { id: "language", label: "语言与地区", icon: Globe },
  { id: "security", label: "安全", icon: Shield },
];

export interface AppSettings {
  profile: {
    displayName: string;
    email: string;
    bio: string;
  };
  appearance: {
    theme: "light" | "dark" | "system";
  };
  notifications: {
    pipeline: boolean;
    mention: boolean;
    weekly: boolean;
  };
  language: {
    language: string;
    timezone: string;
  };
  security: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  };
}

const STORAGE_KEY = "ordine_settings_v1";

const defaultSettings: AppSettings = {
  profile: {
    displayName: "Ordine 用户",
    email: "user@ordine.app",
    bio: "Skill Pipeline 设计师",
  },
  appearance: { theme: "light" },
  notifications: {
    pipeline: true,
    mention: true,
    weekly: false,
  },
  language: {
    language: "zh-CN",
    timezone: "Asia/Shanghai",
  },
  security: {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  },
};

const loadSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return { ...defaultSettings, ...parsed };
    }
  } catch {
    // ignore
  }
  return defaultSettings;
};

const saveSettings = (settings: AppSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
};

export const SettingsPageContent = () => {
  const [active, setActive] = useState<Section>("profile");
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const updateSection = useCallback(
    <K extends keyof AppSettings>(section: K, patch: Partial<AppSettings[K]>) => {
      setSettings((prev) => ({
        ...prev,
        [section]: { ...prev[section], ...patch },
      }));
    },
    []
  );

  const handleProfileChange = useCallback(
    (patch: Partial<AppSettings["profile"]>) => updateSection("profile", patch),
    [updateSection]
  );
  const handleNotificationsChange = useCallback(
    (patch: Partial<AppSettings["notifications"]>) => updateSection("notifications", patch),
    [updateSection]
  );
  const handleAppearanceChange = useCallback(
    (patch: Partial<AppSettings["appearance"]>) => updateSection("appearance", patch),
    [updateSection]
  );
  const handleLanguageChange = useCallback(
    (patch: Partial<AppSettings["language"]>) => updateSection("language", patch),
    [updateSection]
  );
  const handleSecurityChange = useCallback(
    (patch: Partial<AppSettings["security"]>) => updateSection("security", patch),
    [updateSection]
  );

  const saveChanges = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const handleSave = saveChanges;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
        <h1 className="text-base font-semibold text-foreground">设置</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-52 shrink-0 border-r border-border bg-background py-4">
          {sections.map((s) => {
            const handleClick = () => setActive(s.id);
            return (
              <button
                key={s.id}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                  active === s.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
                onClick={handleClick}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                {s.label}
                {active === s.id && <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-lg space-y-6">
            {active === "profile" && (
              <ProfileSection
                saved={saved}
                values={settings.profile}
                onChange={handleProfileChange}
                onSave={handleSave}
              />
            )}
            {active === "notifications" && (
              <NotificationsSection
                saved={saved}
                values={settings.notifications}
                onChange={handleNotificationsChange}
                onSave={handleSave}
              />
            )}
            {active === "appearance" && (
              <AppearanceSection
                saved={saved}
                values={settings.appearance}
                onChange={handleAppearanceChange}
                onSave={handleSave}
              />
            )}
            {active === "language" && (
              <LanguageSection
                saved={saved}
                values={settings.language}
                onChange={handleLanguageChange}
                onSave={handleSave}
              />
            )}
            {active === "security" && (
              <SecuritySection
                saved={saved}
                values={settings.security}
                onChange={handleSecurityChange}
                onSave={handleSave}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
