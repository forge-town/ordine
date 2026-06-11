import { useMemo, type ChangeEvent } from "react";
import { useList } from "@refinedev/core";
import { useNavigate } from "@tanstack/react-router";
import { Boxes, ListChecks, Search, Workflow, type LucideIcon } from "lucide-react";
import { useStore } from "zustand";
import type { Job, PipelineAsset, PipelineData } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Icon, Tag } from "@/components/primitives";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useSidebarStore } from "@/store/sidebarStore";

type GlobalSearchKind = "Component" | "Job" | "Pipeline";

type GlobalSearchResult = {
  description: string;
  icon: LucideIcon;
  id: string;
  kind: GlobalSearchKind;
  label: string;
  meta: string;
};

const MAX_RESULTS_PER_GROUP = 5;

const includesQuery = (query: string, values: string[]) => {
  return values.some((value) => value.toLowerCase().includes(query));
};

const toPipelineResult = (pipeline: PipelineData): GlobalSearchResult => ({
  description: pipeline.description || "Pipeline workspace",
  icon: Workflow,
  id: pipeline.id,
  kind: "Pipeline",
  label: pipeline.name,
  meta: pipeline.status,
});

const toComponentResult = (asset: PipelineAsset): GlobalSearchResult => ({
  description: asset.description || "Reusable pipeline component",
  icon: Boxes,
  id: asset.id,
  kind: "Component",
  label: asset.name,
  meta: `${asset.snapshotNodes.length} nodes`,
});

const toJobResult = (job: Job): GlobalSearchResult => ({
  description: job.error || job.type.replaceAll("_", " "),
  icon: ListChecks,
  id: job.id,
  kind: "Job",
  label: job.title,
  meta: job.status,
});

export const SearchPipelineDialog = () => {
  const navigate = useNavigate();
  const store = useSidebarStore();
  const open = useStore(store, (s) => s.searchOpen);
  const query = useStore(store, (s) => s.sidebarSearchQuery);
  const handleSearchDialogOpenChange = useStore(store, (s) => s.handleSearchDialogOpenChange);
  const handleSidebarSearchChange = useStore(store, (s) => s.handleSidebarSearchChange);
  const handleSidebarSearchClear = useStore(store, (s) => s.handleSidebarSearchClear);
  const { result: pipelinesResult } = useList<PipelineData>({
    resource: ResourceName.pipelines,
  });
  const { result: assetsResult } = useList<PipelineAsset>({
    resource: ResourceName.pipelineAssets,
  });
  const { result: jobsResult } = useList<Job>({
    resource: ResourceName.jobs,
  });
  const normalizedQuery = query.trim().toLowerCase();

  const pipelineResults = useMemo(() => {
    if (!normalizedQuery) return [];

    return pipelinesResult.data
      .filter((pipeline) =>
        includesQuery(normalizedQuery, [pipeline.name, pipeline.description, pipeline.status]),
      )
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map(toPipelineResult);
  }, [normalizedQuery, pipelinesResult.data]);

  const componentResults = useMemo(() => {
    if (!normalizedQuery) return [];

    return assetsResult.data
      .filter((asset) =>
        includesQuery(normalizedQuery, [
          asset.name,
          asset.description,
          asset.tags.join(" "),
          asset.inputSlots.map((slot) => `${slot.label} ${slot.acceptTypes.join(" ")}`).join(" "),
        ]),
      )
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map(toComponentResult);
  }, [assetsResult.data, normalizedQuery]);

  const jobResults = useMemo(() => {
    if (!normalizedQuery) return [];

    return jobsResult.data
      .filter((job) =>
        includesQuery(normalizedQuery, [
          job.title,
          job.type,
          job.status,
          job.error ?? "",
          job.pipelineId ?? "",
        ]),
      )
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map(toJobResult);
  }, [jobsResult.data, normalizedQuery]);

  const resultGroups = [
    { label: "Pipelines", results: pipelineResults },
    { label: "Components", results: componentResults },
    { label: "Jobs", results: jobResults },
  ];
  const totalResults = pipelineResults.length + componentResults.length + jobResults.length;

  const handleOpenChange = (value: boolean) => {
    handleSearchDialogOpenChange(value);
    if (!value) handleSidebarSearchClear();
  };

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleSidebarSearchChange(event.target.value);
  };

  const handleSelectResult = (result: GlobalSearchResult) => {
    handleSearchDialogOpenChange(false);
    handleSidebarSearchClear();
    if (result.kind === "Pipeline") {
      void navigate({ to: "/workspace/$pipelineId", params: { pipelineId: result.id } });

      return;
    }
    if (result.kind === "Job") {
      void navigate({ to: "/pipelines/jobs/$jobId", params: { jobId: result.id } });

      return;
    }

    void navigate({ to: "/components" });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">Global search</DialogTitle>
        <DialogDescription className="sr-only">
          Search pipelines, components, and jobs.
        </DialogDescription>
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            className="h-11 border-0 px-0 shadow-none focus-visible:ring-0"
            placeholder="Search pipelines, components, jobs..."
            value={query}
            onChange={handleQueryChange}
          />
        </div>
        <div className="max-h-[min(520px,70vh)] overflow-y-auto p-2">
          {normalizedQuery && totalResults === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results for "{query}"
            </div>
          ) : null}
          {normalizedQuery ? null : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Search across pipelines, components, and jobs.
            </div>
          )}
          {resultGroups.map((group) =>
            group.results.length > 0 ? (
              <section key={group.label} className="py-1">
                <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.results.map((result) => (
                    <Button
                      key={`${result.kind}-${result.id}`}
                      className="flex h-auto w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left"
                      type="button"
                      variant="ghost"
                      onClick={() => handleSelectResult(result)}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
                        <Icon className="text-foreground/75" icon={result.icon} size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">
                          {result.label}
                        </span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">
                          {result.description}
                        </span>
                      </span>
                      <Tag>{result.meta}</Tag>
                    </Button>
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
