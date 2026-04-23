import { useState } from "react";
import { Globe, Code, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
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
      <div className="flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
        <h1 className="text-base font-semibold text-foreground">{t("settings.title")}</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-52 shrink-0 border-r border-border bg-background py-4">
          {SECTION_IDS.map((id) => {
            const Icon = SECTION_ICONS[id];
            const label = t(`settings.sections.${id}`);
            const handleClick = () => setActive(id);

            return (
              <button
                key={id}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                  active === id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
                onClick={handleClick}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {active === id && <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary" />}
              </button>
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
