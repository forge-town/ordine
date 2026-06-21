import { useState } from "react";
import { Globe, Code, ChevronRight, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { DeveloperSection, LanguageSection } from "../sections";

type Section = "language" | "developer";

const SECTION_ICONS: Record<Section, React.FC<{ className?: string }>> = {
  language: Globe,
  developer: Code,
};

const SECTION_IDS: Section[] = ["language", ...(import.meta.env.DEV ? ["developer" as const] : [])];

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
          {SECTION_IDS.map((id) => {
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
                variant="ghost"
                onClick={handleClick}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {active === id && <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary" />}
              </Button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-lg space-y-6">
            {active === "language" && <LanguageSection />}
            {active === "developer" && <DeveloperSection />}
          </div>
        </div>
      </div>
    </div>
  );
};
