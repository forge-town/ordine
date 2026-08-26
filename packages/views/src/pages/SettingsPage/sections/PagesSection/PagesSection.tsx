import {
  Activity,
  BookOpen,
  Box,
  Boxes,
  ChevronRight,
  Cpu,
  FlaskConical,
  Gauge,
  Plug,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SectionHeader } from "../../SectionHeader";

const PAGE_LINKS = [
  { icon: Boxes, labelKey: "nav.components", to: "/components" },
  { icon: Zap, labelKey: "nav.operations", to: "/pipelines/operations" },
  { icon: Box, labelKey: "nav.objects", to: "/pipelines/objects" },
  { icon: Activity, labelKey: "nav.jobs", to: "/pipelines/jobs" },
  { icon: Gauge, labelKey: "nav.items.usage", to: "/usage" },
  { icon: FlaskConical, labelKey: "nav.distillations", to: "/distillations" },
  { icon: Cpu, labelKey: "nav.items.localAgents", to: "/local-agents" },
  { icon: BookOpen, labelKey: "nav.skills", to: "/skills" },
  { icon: Plug, labelKey: "nav.items.connectors", to: "/connectors" },
] as const;

export const PagesSection = () => {
  const { t } = useTranslation();

  return (
    <section>
      <SectionHeader
        description={t("settings.pages.description")}
        title={t("settings.pages.title")}
      />
      <div className="grid gap-1">
        {PAGE_LINKS.map((link) => {
          const Icon = link.icon;

          return (
            <Link
              key={link.to}
              className="flex h-9 items-center gap-2.5 rounded-md px-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              to={link.to}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t(link.labelKey)}</span>
              <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </section>
  );
};
