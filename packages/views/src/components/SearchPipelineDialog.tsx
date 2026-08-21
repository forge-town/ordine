import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useList } from "@refinedev/core";
import { useStore } from "zustand";
import { useHotkeys } from "react-hotkeys-hook";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Button } from "@repo/ui/button";
import { ResourceName } from "../constants";
import type { PipelineData } from "@repo/schemas";
import { useSidebarStore } from "../store/sidebarStore";
import { Icon, Tag } from "./primitives";

export const SearchPipelineDialog = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const store = useSidebarStore();
  const open = useStore(store, (s) => s.searchOpen);
  const handleSearchDialogOpenChange = useStore(store, (s) => s.handleSearchDialogOpenChange);
  const [query, setQuery] = useState("");

  useHotkeys(
    "ctrl+k, meta+k",
    () => handleSearchDialogOpenChange(true),
    { enableOnFormTags: true, preventDefault: true },
    [handleSearchDialogOpenChange],
  );

  const { result: pipelinesResult } = useList<PipelineData>({
    resource: ResourceName.pipelines,
  });
  const pipelinesData = pipelinesResult?.data;

  const filtered = useMemo(() => {
    const items = pipelinesData ?? [];
    const q = query.toLowerCase().trim();
    if (!q) return items;

    return items.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q),
    );
  }, [pipelinesData, query]);

  const handleSelect = (pipeline: PipelineData) => {
    handleSearchDialogOpenChange(false);
    setQuery("");
    void navigate({ to: "/canvas", search: { id: pipeline.id } });
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value);

  const handleOpenChange = (value: boolean) => {
    handleSearchDialogOpenChange(value);
    if (!value) setQuery("");
  };

  const normalizedQuery = query.trim().toLowerCase();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">{t("nav.search")}</DialogTitle>
        <DialogDescription className="sr-only">{t("pipelines.title")}</DialogDescription>
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            aria-label={t("nav.search")}
            className="h-11 border-0 px-0 shadow-none focus-visible:ring-0"
            placeholder={t("nav.search")}
            value={query}
            onChange={handleQueryChange}
          />
        </div>
        <div className="max-h-[min(520px,70vh)] overflow-y-auto p-2">
          {normalizedQuery ? (
            filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t("pipelines.noPipelines")} “{query}”
              </div>
            ) : (
              <section className="py-1">
                <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {t("nav.pipelines")}
                </div>
                <div className="space-y-1">
                  {filtered.map((pipeline) => (
                    <Button
                      key={pipeline.id}
                      className="flex h-auto w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left"
                      type="button"
                      variant="ghost"
                      onClick={() => handleSelect(pipeline)}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
                        <Icon className="text-foreground/75" icon={Workflow} size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">
                          {pipeline.name}
                        </span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">
                          {pipeline.description || t("pipelines.title")}
                        </span>
                      </span>
                      <Tag>{pipeline.status ?? "pipeline"}</Tag>
                    </Button>
                  ))}
                </div>
              </section>
            )
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("nav.searchPipelinesHint", {
                defaultValue: "Search across your pipeline workspaces.",
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
