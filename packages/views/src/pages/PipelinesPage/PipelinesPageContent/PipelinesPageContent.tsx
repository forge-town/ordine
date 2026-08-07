import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GitBranch, Plus, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { useCreate, useList } from "@refinedev/core";
import type { Job, PipelineAsset, PipelineData, Routine } from "@repo/schemas";
import { useStore } from "zustand";
import { ResourceName } from "../../../constants";
import { PageLoadingState } from "../../../components/PageLoadingState";
import { PageHeader } from "../../../components/PageHeader";
import { ScheduleEditor } from "../../../components/ScheduleEditor";
import { Chip, SearchInput } from "../../../components/primitives";
import { usePipelinesPageStore } from "../_store";
import { PipelineCard } from "../PipelineCard";
import { buildPipelineMetrics, filterPipelines } from "../pipelineMetrics";
import { sidebarStore } from "../../../store/sidebarStore";

const filterKeys = ["all", "savedSkills", "drafts", "scheduled"] as const;

export const PipelinesPageContent = () => {
  const { t } = useTranslation();
  const { result: pipelinesResult, query: pipelinesQuery } = useList<PipelineData>({
    resource: ResourceName.pipelines,
  });
  const pipelinesData = pipelinesResult?.data;
  const pipelines = pipelinesData ?? [];
  const { result: assetsResult } = useList<PipelineAsset>({
    resource: ResourceName.pipelineAssets,
  });
  const { result: jobsResult } = useList<Job>({ resource: ResourceName.jobs });
  const { result: routinesResult, query: routinesQuery } = useList<Routine>({
    resource: ResourceName.routines,
  });
  const store = usePipelinesPageStore();
  const search = useStore(store, (s) => s.search);
  const selectedTags = useStore(store, (s) => s.selectedTags);
  const activeFilter = useStore(store, (s) => s.activeFilter);
  const currentProjectId = useStore(sidebarStore, (s) => s.currentProjectId);
  const handleSearchInputChange = useStore(store, (s) => s.handleSearchInputChange);
  const handleClearSearchButtonClick = useStore(store, (s) => s.handleClearSearchButtonClick);
  const handleTagBadgeClick = useStore(store, (s) => s.handleTagBadgeClick);
  const handleClearTagsButtonClick = useStore(store, (s) => s.handleClearTagsButtonClick);
  const handleFilterChange = useStore(store, (s) => s.handleFilterChange);
  const navigate = useNavigate();
  const { mutateAsync: createPipelineMutate } = useCreate();
  const [schedulePipelineId, setSchedulePipelineId] = useState<string | null>(null);
  const metricsByPipeline = useMemo(
    () =>
      buildPipelineMetrics(
        (pipelinesData ?? []).map((pipeline) => pipeline.id),
        jobsResult.data,
        assetsResult.data,
        routinesResult.data,
      ),
    [assetsResult.data, jobsResult.data, pipelinesData, routinesResult.data],
  );

  const allTags = useMemo(() => {
    const items = pipelinesData ?? [];
    const tagSet = new Set<string>();
    for (const p of items) {
      for (const tag of p.tags) tagSet.add(tag);
    }

    return [...tagSet].sort();
  }, [pipelinesData]);

  const filtered = useMemo(() => {
    return filterPipelines({
      pipelines: pipelinesData ?? [],
      metricsByPipeline,
      search,
      selectedTags,
      currentProjectId,
      activeFilter,
    });
  }, [activeFilter, currentProjectId, metricsByPipeline, pipelinesData, search, selectedTags]);

  const handleCreate = async () => {
    const id = `pipeline-${Date.now()}`;
    const now = new Date();
    const newPipeline: PipelineData = {
      id,
      name: t("pipelines.createNew"),
      description: t("pipelines.newPipelineDescription"),
      sharedContext: "",
      tags: [],
      createdAt: now,
      updatedAt: now,
      timeoutMs: null,
      projectId: currentProjectId,
      status: "draft",
      version: 1,
      nodes: [],
      edges: [],
    };
    const result = await createPipelineMutate({
      resource: ResourceName.pipelines,
      values: newPipeline,
    });
    const saved = result.data as PipelineData;
    void navigate({ to: "/canvas", search: { id: saved.id } });
  };

  const handleCreateClick = () => void handleCreate();
  const handleScheduleOpen = (pipelineId: string) => () => setSchedulePipelineId(pipelineId);
  const handleScheduleClose = () => setSchedulePipelineId(null);
  const scheduledPipeline = pipelines.find((pipeline) => pipeline.id === schedulePipelineId);
  const scheduledRoutines = routinesResult.data.filter(
    (routine) => routine.pipelineId === schedulePipelineId,
  );

  if (pipelinesQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          eyebrow={t("nav.groups.assembly")}
          icon={<GitBranch className="h-4 w-4 text-primary" />}
          sub={t("pipelines.subtitle")}
          title={t("pipelines.title")}
        />
        <PageLoadingState variant="grid" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button className="flex items-center gap-1.5" size="sm" onClick={handleCreateClick}>
            <Plus className="h-3.5 w-3.5" />
            {t("pipelines.createNew")}
          </Button>
        }
        eyebrow={t("nav.groups.assembly")}
        icon={<GitBranch className="h-4 w-4 text-primary" />}
        sub={t("pipelines.subtitle")}
        title={t("pipelines.title")}
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b border-border bg-background px-4 py-3 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            aria-label={t("pipelines.filters.label")}
            className="flex flex-wrap gap-1"
            role="group"
          >
            {filterKeys.map((filter) => (
              <Chip
                key={filter}
                active={activeFilter === filter}
                onClick={() => handleFilterChange(filter)}
              >
                {t(`pipelines.filters.${filter}`)}
              </Chip>
            ))}
          </div>
          <SearchInput
            className="w-full sm:w-64"
            clearLabel={t("common.clearSearch")}
            label={t("common.search")}
            placeholder={t("common.search")}
            value={search}
            onChange={handleSearchInputChange}
            onClear={handleClearSearchButtonClick}
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {selectedTags.length > 0 && (
              <Button
                className="mr-1 h-6 px-2 text-[11px]"
                size="sm"
                variant="ghost"
                onClick={handleClearTagsButtonClick}
              >
                {t("common.clear")}
              </Button>
            )}
            {allTags.map((tag) => (
              <Chip
                key={tag}
                active={selectedTags.includes(tag)}
                onClick={() => handleTagBadgeClick(tag)}
              >
                #{tag}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        {filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <Layers className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm">
              {pipelines.length === 0 ? t("pipelines.noPipelines") : t("common.noResults")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <PipelineCard
                key={p.id}
                metrics={metricsByPipeline.get(p.id)!}
                pipeline={p}
                onSchedule={
                  routinesQuery?.isLoading || routinesQuery?.isError
                    ? undefined
                    : handleScheduleOpen(p.id)
                }
              />
            ))}
          </div>
        )}
      </div>
      {scheduledPipeline ? (
        <ScheduleEditor
          pipelineId={scheduledPipeline.id}
          pipelineName={scheduledPipeline.name}
          routines={scheduledRoutines}
          onClose={handleScheduleClose}
        />
      ) : null}
    </div>
  );
};
