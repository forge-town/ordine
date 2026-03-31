import { useState } from "react";
import {
  User,
  Bell,
  Palette,
  Globe,
  Shield,
  ChevronRight,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import {
  AppearanceSection,
  LanguageSection,
  NotificationsSection,
  ProfileSection,
  SecuritySection,
} from "./sections";

type Section =
  | "profile"
  | "notifications"
  | "appearance"
  | "language"
  | "security";

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

export const SettingsPageContent = () => {
  const [active, setActive] = useState<Section>("profile");
  const [saved, setSaved] = useState(false);

  const saveChanges = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center border-b bg-background px-6">
        <h1 className="text-base font-semibold">设置</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-52 shrink-0 border-r bg-background py-4">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                active === s.id
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              {s.label}
              {active === s.id && (
                <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary" />
              )}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-lg space-y-6">
            {active === "profile" && (
              <ProfileSection onSave={saveChanges} saved={saved} />
            )}
            {active === "notifications" && (
              <NotificationsSection onSave={saveChanges} saved={saved} />
            )}
            {active === "appearance" && (
              <AppearanceSection onSave={saveChanges} saved={saved} />
            )}
            {active === "language" && (
              <LanguageSection onSave={saveChanges} saved={saved} />
            )}
            {active === "security" && (
              <SecuritySection onSave={saveChanges} saved={saved} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
