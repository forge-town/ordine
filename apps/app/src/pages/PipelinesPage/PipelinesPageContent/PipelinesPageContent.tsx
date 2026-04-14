import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Layers, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Badge } from "@repo/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import { Route } from "@/routes/_layout/pipelines.index";
import { createPipeline, deletePipeline } from "@/services/pipelinesService";
import type { StoredPipeline } from "@repo/models";
import { PipelineCard } from "../PipelineCard";

export const PipelinesPageContent = () => {
  const { t } = useTranslation();
  const loaderPipelines = Route.useLoaderData();
  const [pipelines, setPipelines] = React.useState<StoredPipeline[]>(loaderPipelines);
  const [search, setSearch] = React.useState("");
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const navigate = useNavigate();

  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    for (const p of pipelines) {
      for (const tag of p.tags) tagSet.add(tag);
    }
    return [...tagSet].sort();
  }, [pipelines]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value);
  const handleClearSearch = () => setSearch("");

  const handleTagClick = (tag: string) => () => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleClearTags = () => setSelectedTags([]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return pipelines.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q);
      const matchesTags = selectedTags.every((tag) => p.tags.includes(tag));
      return matchesSearch && matchesTags;
    });
  }, [pipelines, search, selectedTags]);

  const openPipeline = (id: string) => {
    void navigate({ to: "/canvas", search: { id } });
  };

  const handleCreate = async () => {
    const id = `pipeline-${Date.now()}`;
    const now = Date.now();
    const newPipeline: StoredPipeline = {
      id,
      name: t("pipelines.createNew"),
      description: t("pipelines.newPipelineDescription"),

      tags: [],
      nodeCount: 1,
      createdAt: now,
      updatedAt: now,
      nodes: [
        {
          id: `${id}-condition`,
          type: "condition",
          position: { x: 300, y: 200 },
          data: {
            label: t("pipelines.conditionNodeLabel"),
            nodeType: "condition",
            expression: "",
            expectedResult: "",
            status: "idle",
          },
        },
      ],
      edges: [],
    };
    const saved = (await createPipeline({
      data: newPipeline,
    })) as StoredPipeline;
    setPipelines((prev) => [saved, ...prev]);
    void navigate({ to: "/canvas", search: { id: saved.id } });
  };

  const handleDelete = async (id: string) => {
    setPipelines((prev) => prev.filter((p) => p.id !== id));
    await deletePipeline({ data: { id } });
  };

  const handleCreateClick = () => void handleCreate();
  const handleOpenPipeline = (id: string) => () => openPipeline(id);
  const handleDeletePipeline = (id: string) => () => void handleDelete(id);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
        <div>
          <h1 className="text-base font-semibold text-foreground">{t("pipelines.title")}</h1>
          <p className="text-xs text-muted-foreground">
            {filtered.length === pipelines.length
              ? pipelines.length
              : `${filtered.length} / ${pipelines.length}`}
          </p>
        </div>
        <Button className="flex items-center gap-1.5" size="sm" onClick={handleCreateClick}>
          <Plus className="h-3.5 w-3.5" />
          {t("pipelines.createNew")}
        </Button>
      </div>

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
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
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
              <PipelineCard
                key={p.id}
                pipeline={p}
                onDelete={handleDeletePipeline(p.id)}
                onOpen={handleOpenPipeline(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
