import { useTranslation } from "react-i18next";
import { useList } from "@refinedev/core";
import type { Job } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";

export const DashboardRunningJobsBadge = () => {
  const { t } = useTranslation();
  const { result } = useList<Job>({ resource: ResourceName.jobs });
  const runningJobs = (result?.data ?? []).filter((job) => job.status === "running").length;

  if (runningJobs === 0) {
    return null;
  }

  return (
    <span className="ml-3 flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {runningJobs} {t("jobs.running")}
    </span>
  );
};
