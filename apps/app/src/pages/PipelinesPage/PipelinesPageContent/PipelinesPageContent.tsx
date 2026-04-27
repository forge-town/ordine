import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GitBranch, Plus, Layers, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Badge } from "@repo/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import { useCreate, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { PipelineData } from "@repo/pipeline-engine/schemas";
import { useStore } from "zustand";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { usePipelinesPageStore } from "../_store";
import { PipelineCard } from "../PipelineCard";

export const PipelinesPageContent = () => {
  const { t } = useTranslation();
  const { result: pipelinesResult, query: pipelinesQuery } = useList<PipelineData>({
    resource: ResourceName.pipelines,
  });
  const pipelinesData = pipelinesResult?.data;
  const pipelines = pipelinesData ?? [];
  const store = usePipelinesPageStore();
  const search = useStore(store, (s) => s.search);
  const selectedTags = useStore(store, (s) => s.selectedTags);
  const handleSetSearch = useStore(store, (s) => s.handleSetSearch);
  const handleToggleTag = useStore(store, (s) => s.handleToggleTag);
  const handleClearTags = useStore(store, (s) => s.handleClearTags);
  const navigate = useNavigate();
  const { mutateAsync: createPipelineMutate } = useCreate();

  const allTags = useMemo(() => {
    const items = pipelinesData ?? [];
    const tagSet = new Set<string>();
    for (const p of items) {
      for (const tag of p.tags) tagSet.add(tag);
    }

    return [...tagSet].sort();
  }, [pipelinesData]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    handleSetSearch(e.target.value);
  const handleClearSearch = () => handleSetSearch("");

  const handleTagClick = (tag: string) => () => {
    handleToggleTag(tag);
  };

  const filtered = useMemo(() => {
    const items = pipelinesData ?? [];
    const q = search.toLowerCase();

    return items.filter((p: PipelineData) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q);
      const matchesTags = selectedTags.every((tag) => p.tags.includes(tag));

      return matchesSearch && matchesTags;
    });
  }, [pipelinesData, search, selectedTags]);

  const handleCreate = async () => {
    const id = `pipeline-${Date.now()}`;
    const now = new Date();
    const newPipeline: PipelineData = {
      id,
      name: t("pipelines.createNew"),
      description: t("pipelines.newPipelineDescription"),
      tags: [],
      createdAt: now,
      updatedAt: now,
      timeoutMs: null,
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

  if (pipelinesQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("pipelines.title")} />
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
        icon={<GitBranch className="h-4 w-4 text-primary" />}
        title={t("pipelines.title")}
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b border-border bg-background px-6 py-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 pr-8 text-sm"
            placeholder={t("common.search")}
            type="text"
            value={search}
            onChange={handleSearchChange}
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={handleClearSearch}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {selectedTags.length > 0 && (
              <Button
                className="mr-1 h-6 px-2 text-[11px]"
                size="sm"
                variant="ghost"
                onClick={handleClearTags}
              >
                {t("common.clear")}
              </Button>
            )}
            {allTags.map((tag) => (
              <Badge
                key={tag}
                className={cn(
                  "cursor-pointer select-none text-[11px] transition-colors",
                  selectedTags.includes(tag)
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
                variant="secondary"
                onClick={handleTagClick(tag)}
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <Layers className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm">
              {pipelines.length === 0 ? t("pipelines.noPipelines") : t("common.noResults")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((p) => (
              <PipelineCard key={p.id} pipeline={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
