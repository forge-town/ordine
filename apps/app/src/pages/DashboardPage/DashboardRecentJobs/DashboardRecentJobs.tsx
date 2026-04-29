import { Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useList } from "@refinedev/core";
import type { Job } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { JobActivityRow } from "../JobActivityRow";
import { buildRecentJobs } from "../dashboardMetrics";

export const DashboardRecentJobs = () => {
  const { t } = useTranslation();
  const { result } = useList<Job>({ resource: ResourceName.jobs });
  const recentJobs = buildRecentJobs(result?.data ?? []);

  if (recentJobs.length === 0) {
    return (
      <div className="flex min-h-55 flex-col items-center justify-center text-center">
        <Activity className="h-7 w-7 text-muted-foreground/30" />
        <p className="mt-3 text-sm text-muted-foreground">{t("dashboard.noJobs")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {recentJobs.map((job) => (
        <JobActivityRow key={job.id} job={job} />
      ))}
    </div>
  );
};
