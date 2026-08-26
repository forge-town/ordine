import { useState, type ComponentType } from "react";
import {
  Bell,
  ChevronRight,
  Code,
  FolderKanban,
  Globe,
  Keyboard,
  Settings,
  ShieldCheck,
  Sliders,
  SquareStack,
  Wrench,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { cn } from "@repo/ui/lib/utils";
import { PageHeader } from "../../../components/PageHeader";
import {
  AdvancedSection,
  AutonomySection,
  DefaultsSection,
  DeveloperSection,
  KeyboardSection,
  LanguageSection,
  NotificationsSection,
  PagesSection,
  ProjectSection,
} from "../sections";

type Section =
  | "advanced"
  | "autonomy"
  | "defaults"
  | "developer"
  | "language"
  | "notifications"
  | "pages"
  | "project";

const SECTION_ICONS: Record<Section, ComponentType<{ className?: string }>> = {
  advanced: Wrench,
  autonomy: ShieldCheck,
  defaults: Sliders,
  developer: Code,
  language: Globe,
  notifications: Bell,
  pages: SquareStack,
  project: FolderKanban,
};

const SECTION_GROUPS: Array<{ ids: Section[]; titleKey: string }> = [
  { ids: ["language", "notifications"], titleKey: "settings.groups.workspace" },
  { ids: ["defaults", "autonomy"], titleKey: "settings.groups.execution" },
  { ids: ["pages"], titleKey: "settings.groups.pages" },
  {
    ids: ["project", "advanced", ...(import.meta.env.DEV ? (["developer"] as Section[]) : [])],
    titleKey: "settings.groups.data",
  },
];

export const SettingsPageContent = () => {
  const { t } = useTranslation();
  const [active, setActive] = useState<Section>("language");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const handleKeyboardOpen = () => setKeyboardOpen(true);
  const handleKeyboardOpenChange = (open: boolean) => setKeyboardOpen(open);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button
            aria-label={t("settings.sections.keyboard")}
            data-testid="settings-keyboard-help"
            size="sm"
            type="button"
            variant="outline"
            onClick={handleKeyboardOpen}
          >
            <Keyboard className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">{t("settings.sections.keyboard")}</span>
          </Button>
        }
        icon={<Settings className="h-4 w-4 text-primary" />}
        title={t("settings.title")}
      />
      <Dialog open={keyboardOpen} onOpenChange={handleKeyboardOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="sr-only">{t("settings.sections.keyboard")}</DialogTitle>
          </DialogHeader>
          <KeyboardSection />
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <nav className="shrink-0 border-b border-border bg-background md:w-52 md:border-b-0 md:border-r md:py-4">
          <div className="flex gap-1 overflow-x-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:block md:p-0">
            {SECTION_GROUPS.map((group) => (
              <div key={group.titleKey} className="contents md:block md:pb-3">
                <div className="hidden px-4 pb-1 text-[10px] font-semibold uppercase text-muted-foreground md:block">
                  {t(group.titleKey)}
                </div>
                {group.ids.map((id) => {
                  const Icon = SECTION_ICONS[id];
                  const label = t(`settings.sections.${id}`);
                  const handleSectionClick = () => setActive(id);

                  return (
                    <Button
                      key={id}
                      className={cn(
                        "h-9 w-auto shrink-0 justify-start gap-2 rounded-md px-3 text-sm md:w-full md:rounded-none md:px-4",
                        active === id
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                      )}
                      data-testid={`settings-nav-${id}`}
                      type="button"
                      variant="ghost"
                      onClick={handleSectionClick}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                      {active === id ? (
                        <ChevronRight className="ml-auto hidden h-3.5 w-3.5 text-primary md:block" />
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-lg space-y-6">
            {active === "language" && <LanguageSection />}
            {active === "notifications" && <NotificationsSection />}
            {active === "defaults" && <DefaultsSection />}
            {active === "autonomy" && <AutonomySection />}
            {active === "pages" && <PagesSection />}
            {active === "project" && <ProjectSection />}
            {active === "advanced" && <AdvancedSection />}
            {active === "developer" && <DeveloperSection />}
          </div>
        </main>
      </div>
    </div>
  );
};
