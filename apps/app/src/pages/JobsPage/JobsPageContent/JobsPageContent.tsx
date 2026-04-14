import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Activity, Search, Filter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import type { JobEntity } from "@repo/models";
import type { JobStatus } from "@/models/tables/jobs_table";
import { Route } from "@/routes/_layout/jobs.index";
import { deleteJob } from "@/services/jobsService";
import { StatCard } from "../StatCard";
import { JobRow } from "../JobRow";

export const JobsPageContent = () => {
  const initialJobs = Route.useLoaderData() as JobEntity[];
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<JobEntity[]>(initialJobs);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const navigate = useNavigate();

  const STATUS_FILTERS: { value: JobStatus | "all"; label: string }[] = [
    { value: "all", label: t("jobs.filterAll") },
    { value: "running", label: t("jobs.filterRunning") },
    { value: "queued", label: t("jobs.filterQueued") },
    { value: "done", label: t("jobs.filterDone") },
    { value: "failed", label: t("jobs.filterFailed") },
    { value: "cancelled", label: t("jobs.filterCancelled") },
  ];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value);
  const handleStatusFilterClick = (value: JobStatus | "all") => () => setStatusFilter(value);
  const handleJobClick = (jobId: string) => () =>
    void navigate({ to: "/jobs/$jobId", params: { jobId } });
  const handleDeleteJob = (jobId: string) => () => void handleDelete(jobId);

  const filtered = jobs.filter((j) => {
    const matchStatus = statusFilter === "all" || j.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      j.title.toLowerCase().includes(q) ||
      j.id.toLowerCase().includes(q) ||
      j.type.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const handleDelete = async (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    await deleteJob({ data: { id } });
  };

  const counts: Record<JobStatus, number> = {
    queued: jobs.filter((j) => j.status === "queued").length,
    running: jobs.filter((j) => j.status === "running").length,
    done: jobs.filter((j) => j.status === "done").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    cancelled: jobs.filter((j) => j.status === "cancelled").length,
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Activity className="h-4 w-4 text-primary" />
        <h1 className="text-base font-semibold text-foreground">{t("jobs.title")}</h1>
        {counts.running > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            {counts.running} {t("jobs.filterRunning")}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="shrink-0 border-b border-border bg-muted/50 px-6 py-4">
        <div className="grid grid-cols-5 gap-3">
          <StatCard
            color="text-gray-700"
            dot="bg-gray-400"
            label={t("jobs.filterQueued")}
            value={counts.queued}
          />
          <StatCard
            color="text-blue-700"
            dot="bg-blue-500"
            label={t("jobs.filterRunning")}
            value={counts.running}
          />
          <StatCard
            color="text-emerald-700"
            dot="bg-emerald-500"
            label={t("jobs.filterDone")}
            value={counts.done}
          />
          <StatCard
            color="text-red-700"
            dot="bg-red-500"
            label={t("jobs.filterFailed")}
            value={counts.failed}
          />
          <StatCard
            color="text-amber-600"
            dot="bg-amber-400"
            label={t("jobs.filterCancelled")}
            value={counts.cancelled}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-6 py-3">
        <div className="relative w-60">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder={t("common.search")}
            type="text"
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              className="h-7 px-3 text-xs"
              size="sm"
              variant={statusFilter === f.value ? "default" : "ghost"}
              onClick={handleStatusFilterClick(f.value)}
            >
              {f.label}
              {f.value !== "all" && (
                <span className="ml-1 opacity-70">{counts[f.value as JobStatus]}</span>
              )}
            </Button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} / {jobs.length} 条
        </span>
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Activity className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              {search || statusFilter !== "all" ? t("common.notFound") : t("jobs.noJobs")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {search || statusFilter !== "all" ? t("common.search") : t("dashboard.noJobs")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onClick={handleJobClick(job.id)}
                onDelete={handleDeleteJob(job.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
