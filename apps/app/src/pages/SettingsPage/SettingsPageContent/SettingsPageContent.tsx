import { useState } from "react";
import {
  Bell,
  ChevronRight,
  Code,
  FolderKanban,
  Globe,
  Keyboard,
  Settings,
  Sliders,
  Wrench,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import {
  AdvancedSection,
  DefaultsSection,
  DeveloperSection,
  KeyboardSection,
  LanguageSection,
  NotificationsSection,
  ProjectSection,
} from "../sections";

type Section =
  | "advanced"
  | "defaults"
  | "developer"
  | "keyboard"
  | "language"
  | "notifications"
  | "project";

const SECTION_ICONS: Record<Section, React.FC<{ className?: string }>> = {
  advanced: Wrench,
  notifications: Bell,
  defaults: Sliders,
  developer: Code,
  keyboard: Keyboard,
  language: Globe,
  project: FolderKanban,
};

/**
 * N18-01：对照原型 settings.jsx 的三节信息架构（Workspace / Execution / Data）。
 * 现有 section 纯迁移分组，行为零变化；Notifications/Autonomy 组待 N18-04/05
 * 有真实内容后再加入导航（不放空组死界面）。
 */
const SECTION_GROUPS: { ids: Section[]; titleKey: string }[] = [
  { ids: ["language", "notifications", "keyboard"], titleKey: "settings.groups.workspace" },
  { ids: ["defaults"], titleKey: "settings.groups.execution" },
  {
    ids: ["project", "advanced", ...(import.meta.env.DEV ? (["developer"] as Section[]) : [])],
    titleKey: "settings.groups.data",
  },
];

export const SettingsPageContent = () => {
  const { t } = useTranslation();
  const [active, setActive] = useState<Section>("language");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        icon={<Settings className="h-4 w-4 text-primary" />}
        title={t("settings.title")}
      />

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-52 shrink-0 border-r border-border bg-background py-4">
          {SECTION_GROUPS.map((group) => (
            <div key={group.titleKey} className="pb-3">
              <div className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t(group.titleKey)}
              </div>
              {group.ids.map((id) => {
                const Icon = SECTION_ICONS[id];
                const label = t(`settings.sections.${id}`);
                const handleClick = () => setActive(id);

                return (
                  <Button
                    key={id}
                    className={cn(
                      "h-auto w-full justify-start gap-2.5 rounded-none px-4 py-2 text-sm",
                      active === id
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                    data-testid={`settings-nav-${id}`}
                    variant="ghost"
                    onClick={handleClick}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                    {active === id && <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary" />}
                  </Button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-lg space-y-6">
            {active === "language" && <LanguageSection />}
            {active === "notifications" && <NotificationsSection />}
            {active === "defaults" && <DefaultsSection />}
            {active === "project" && <ProjectSection />}
            {active === "keyboard" && <KeyboardSection />}
            {active === "advanced" && <AdvancedSection />}
            {active === "developer" && <DeveloperSection />}
          </div>
        </div>
      </div>
    </div>
  );
};
