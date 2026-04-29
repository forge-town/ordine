import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, LayoutDashboard, Lightbulb, Sparkles, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/PageHeader";
import { DashboardActivityChart } from "../DashboardActivityChart";
import { DashboardDistillationSummary } from "../DashboardDistillationSummary";
import { DashboardPanel } from "../DashboardPanel";
import { DashboardPipelineChart } from "../DashboardPipelineChart";
import { DashboardRecentJobs } from "../DashboardRecentJobs";
import { DashboardRunningJobsBadge } from "../DashboardRunningJobsBadge";
import { DashboardSnapshotStrip } from "../DashboardSnapshotStrip";
import { DashboardStatusChart } from "../DashboardStatusChart";

const QUICK_ACTIONS = [
  {
    icon: Workflow,
    key: "design",
    to: "/canvas",
  },
  {
    icon: Activity,
    key: "monitor",
    to: "/jobs",
  },
  {
    icon: Sparkles,
    key: "distill",
    to: "/distillations",
  },
  {
    icon: Lightbulb,
    key: "bestPractices",
    to: "/best-practices",
  },
] as const;

export const DashboardPageContent = () => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        badge={<DashboardRunningJobsBadge />}
        icon={<LayoutDashboard className="h-4 w-4 text-primary" />}
        title={t("dashboard.title")}
      />

      <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.08),transparent_45%)] p-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
            <DashboardPanel
              description={t("dashboard.activityDescription")}
              title={t("dashboard.activityTitle")}
            >
              <DashboardActivityChart />
            </DashboardPanel>

            <DashboardPanel
              description={t("dashboard.snapshotDescription")}
              title={t("dashboard.snapshotTitle")}
            >
              <DashboardSnapshotStrip />
            </DashboardPanel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <DashboardPanel
              description={t("dashboard.pipelineHealthDescription")}
              title={t("dashboard.pipelineHealthTitle")}
            >
              <DashboardPipelineChart />
            </DashboardPanel>

            <DashboardPanel
              description={t("dashboard.statusDescription")}
              title={t("dashboard.statusTitle")}
            >
              <DashboardStatusChart />
            </DashboardPanel>
          </div>

          <DashboardPanel
            actions={
              <Link
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                to="/distillations"
              >
                {t("dashboard.viewAll")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
            description={t("dashboard.distillationDescription")}
            title={t("dashboard.distillationTitle")}
          >
            <DashboardDistillationSummary />
          </DashboardPanel>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <DashboardPanel
              actions={
                <Link
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  to="/jobs"
                >
                  {t("dashboard.viewAll")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
              description={t("dashboard.recentJobsDescription")}
              title={t("dashboard.recentJobs")}
            >
              <DashboardRecentJobs />
            </DashboardPanel>

            <DashboardPanel
              description={t("dashboard.quickActionsDescription")}
              title={t("dashboard.quickActions")}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;

                  return (
                    <Link key={action.key} to={action.to as "/"}>
                      <div className="group rounded-2xl border border-border/70 bg-background/60 p-4 transition-all hover:border-primary/40 hover:shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                            <Icon className="h-5 w-5" />
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                        </div>
                        <p className="mt-4 text-sm font-semibold text-foreground">
                          {t(
                            `dashboard.quickAction${action.key[0].toUpperCase()}${action.key.slice(1)}`
                          )}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t(
                            `dashboard.quickAction${action.key[0].toUpperCase()}${action.key.slice(1)}Sub`
                          )}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </DashboardPanel>
          </div>
        </div>
      </div>
    </div>
  );
};
