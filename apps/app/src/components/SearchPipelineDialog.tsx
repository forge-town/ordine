import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useList } from "@refinedev/core";
import { useStore } from "zustand";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { PipelineData } from "@repo/schemas";
import { useSidebarStore } from "@/store/sidebarStore";

export const SearchPipelineDialog = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const store = useSidebarStore();
  const open = useStore(store, (s) => s.searchOpen);
  const setOpen = useStore(store, (s) => s.setSearchOpen);
  const [query, setQuery] = useState("");

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
    setOpen(false);
    setQuery("");
    void navigate({ to: "/canvas", search: { id: pipeline.id } });
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{t("nav.search")}</DialogTitle>
        <DialogDescription className="sr-only">{t("pipelines.title")}</DialogDescription>
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            className="h-10 border-0 shadow-none focus-visible:ring-0 px-0"
            placeholder={t("nav.search")}
            value={query}
            onChange={handleQueryChange}
          />
        </div>
        <div className="max-h-75 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t("pipelines.noPipelines")}
            </div>
          ) : (
            filtered.map((pipeline) => (
              <button
                key={pipeline.id}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                type="button"
                onClick={() => handleSelect(pipeline)}
              >
                <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{pipeline.name}</div>
                  {pipeline.description && (
                    <div className="truncate text-xs text-muted-foreground">
                      {pipeline.description}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
