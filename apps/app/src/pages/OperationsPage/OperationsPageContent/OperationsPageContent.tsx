import { useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Zap, Search, Upload, LayoutGrid, List } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCreate, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { Operation } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { useStore } from "zustand";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { cn } from "@repo/ui/lib/utils";
import { useOperationsPageStore } from "../_store";
import { OperationCard } from "../OperationCard";
import { OperationListRow } from "../OperationListRow";

export const OperationsPageContent = () => {
  const { result: operationsResult, query: operationsQuery } = useList<Operation>({
    resource: ResourceName.operations,
  });
  const operations = operationsResult.data;

  const { t } = useTranslation();
  const navigate = useNavigate();
  const pageStore = useOperationsPageStore();
  const searchQuery = useStore(pageStore, (s) => s.searchQuery);
  const sortBy = useStore(pageStore, (s) => s.sortBy);
  const sortOpen = useStore(pageStore, (s) => s.sortOpen);
  const importing = useStore(pageStore, (s) => s.importing);
  const viewMode = useStore(pageStore, (s) => s.viewMode);
  const handleSearchInputChange = useStore(pageStore, (s) => s.handleSearchInputChange);
  const handleClearSearchButtonClick = useStore(pageStore, (s) => s.handleClearSearchButtonClick);
  const handleSortItemSelect = useStore(pageStore, (s) => s.handleSortItemSelect);
  const handleSortSelectOpenChange = useStore(pageStore, (s) => s.handleSortSelectOpenChange);
  const handleSortSelectTriggerClick = useStore(pageStore, (s) => s.handleSortSelectTriggerClick);
  const handleImportFileInputChange = useStore(pageStore, (s) => s.handleImportFileInputChange);
  const handleViewModeButtonClick = useStore(pageStore, (s) => s.handleViewModeButtonClick);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: createResource } = useCreate();

  const filteredOperations = operations
    .filter((op: Operation) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      return op.name.toLowerCase().includes(q) || (op.description ?? "").toLowerCase().includes(q);
    })
    .sort((a: Operation, b: Operation) => {
      switch (sortBy) {
        case "name-asc": {
          return a.name.localeCompare(b.name);
        }
        case "name-desc": {
          return b.name.localeCompare(a.name);
        }
        case "date-asc": {
          return (a.meta?.createdAt?.getTime() ?? 0) - (b.meta?.createdAt?.getTime() ?? 0);
        }
        case "date-desc": {
          return (b.meta?.createdAt?.getTime() ?? 0) - (a.meta?.createdAt?.getTime() ?? 0);
        }
        default: {
          return 0;
        }
      }
    });

  const handleNavigateToNew = () => navigate({ to: "/pipelines/operations/new" });

  const handleImportClick = () => {
    importInputRef.current?.click();
  };
  const handleImportInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void handleImportFileInputChange(event, {
      createOperation: (values) =>
        createResource({
          resource: ResourceName.operations,
          values,
        }),
      createOutputTemplate: (values) =>
        createResource({
          resource: ResourceName.operationOutputItemTemplates,
          values,
        }),
    });
  };

  if (operationsQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("operations.title")} />
        <PageLoadingState variant="list" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <>
            <Button disabled={importing} size="sm" variant="outline" onClick={handleImportClick}>
              <Upload className="h-4 w-4" />
              {importing ? t("common.loading") : t("common.import")}
            </Button>
            <Button size="sm" onClick={handleNavigateToNew}>
              <Plus className="h-4 w-4" />
              {t("operations.createNew")}
            </Button>
            <input
              ref={importInputRef}
              accept=".zip,application/zip"
              className="hidden"
              type="file"
              onChange={handleImportInputChange}
            />
          </>
        }
        icon={<Zap className="h-4 w-4 text-primary" />}
        title={t("operations.title")}
      />

      {/* Search + filter toolbar */}
      <div className="flex shrink-0 items-center gap-3 bg-muted/30 px-6 py-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm bg-background"
            placeholder={t("operations.searchPlaceholder")}
            type="text"
            value={searchQuery}
            onChange={handleSearchInputChange}
          />
        </div>

        <Label className="sr-only" htmlFor="sort-select">
          {t("common.actions")}
        </Label>
        <Select
          open={sortOpen}
          value={sortBy}
          onOpenChange={handleSortSelectOpenChange}
          onValueChange={handleSortItemSelect}
        >
          <SelectTrigger
            aria-label={t("common.actions")}
            className="h-8 w-36 text-xs bg-background"
            id="sort-select"
            onClick={handleSortSelectTriggerClick}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="default">{t("operations.sortDefault")}</SelectItem>
              <SelectItem value="name-asc">{t("operations.sortNameAsc")}</SelectItem>
              <SelectItem value="name-desc">{t("operations.sortNameDesc")}</SelectItem>
              <SelectItem value="date-desc">{t("operations.sortDateDesc")}</SelectItem>
              <SelectItem value="date-asc">{t("operations.sortDateAsc")}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-2 text-xs text-muted-foreground tabular-nums">
            {filteredOperations.length}
          </span>
          <Button
            className={cn("h-8 w-8", viewMode === "grid" && "bg-accent")}
            size="icon"
            variant="ghost"
            onClick={() => handleViewModeButtonClick("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            className={cn("h-8 w-8", viewMode === "list" && "bg-accent")}
            size="icon"
            variant="ghost"
            onClick={() => handleViewModeButtonClick("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {filteredOperations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center px-6">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-border">
              <Zap className="h-7 w-7 text-muted-foreground/50" />
            </div>
            {searchQuery.trim() ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">{t("common.notFound")}</p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  onClick={handleClearSearchButtonClick}
                >
                  {t("common.clearSearch", "Clear search")}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">
                  {t("operations.noOperations")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  {t("operations.createNew")}
                </p>
                <Button className="mt-4" size="sm" onClick={handleNavigateToNew}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  {t("operations.createNew")}
                </Button>
              </>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOperations.map((op) => (
              <OperationCard key={op.id} operation={op} />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredOperations.map((op) => (
              <OperationListRow key={op.id} operation={op} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
