import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Plus,
  Pencil,
  Trash2,
  Zap,
  FileCode,
  Folder,
  FolderGit2,
  ExternalLink,
  Search,
  Download,
  Upload,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCreate, useDelete, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { OperationRecord } from "@repo/db-schema";
import type { ObjectType } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { useToastStore } from "@/store/toastStore";
import { safeJsonParse } from "@/lib/safeJson";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";

const exportOperation = (op: OperationRecord) => {
  const data = JSON.stringify(op, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${op.name.replaceAll(/\s+/g, "-").toLowerCase()}.operation.json`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const OperationsPageContent = () => {
  const { result: operationsResult } = useList<OperationRecord>({
    resource: ResourceName.operations,
  });
  const operations = operationsResult?.data ?? [];
  type SortKey = "default" | "name-asc" | "name-desc" | "date-asc" | "date-desc";

  const { t } = useTranslation();

  const OBJECT_TYPE_OPTIONS: {
    value: ObjectType;
    label: string;
    icon: React.ElementType;
  }[] = [
    { value: "file", label: t("operations.objectTypeFile"), icon: FileCode },
    { value: "folder", label: t("operations.objectTypeFolder"), icon: Folder },
    {
      value: "project",
      label: t("operations.objectTypeProject"),
      icon: FolderGit2,
    },
  ];

  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const { mutate: deleteOpMutate } = useDelete();
  const { mutateAsync: createOpMutate } = useCreate();
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("default");

  const filteredOperations = operations
    .filter((op: OperationRecord) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      return op.name.toLowerCase().includes(q) || (op.description ?? "").toLowerCase().includes(q);
    })
    .sort((a: OperationRecord, b: OperationRecord) => {
      switch (sortBy) {
        case "name-asc": {
          return a.name.localeCompare(b.name);
        }
        case "name-desc": {
          return b.name.localeCompare(a.name);
        }
        case "date-asc": {
          return a.createdAt.getTime() - b.createdAt.getTime();
        }
        case "date-desc": {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        default: {
          return 0;
        }
      }
    });

  const openCreate = () => {
    navigate({ to: "/operations/new" });
  };

  const handleDelete = (id: string) => {
    deleteOpMutate({ resource: ResourceName.operations, id });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearchQuery(e.target.value);

  const handleSortChange = (value: string | null) => {
    setSortBy((value ?? "default") as SortKey);
    setSortOpen(false);
  };

  const [sortOpen, setSortOpen] = useState(false);
  const handleSortOpenChange = (v: boolean) => setSortOpen(v);
  const handleSortToggle = () => setSortOpen((prev) => !prev);

  const handleOpenCreate = () => openCreate();

  const handleEditClick = (op: OperationRecord) => () =>
    navigate({
      to: "/operations/$operationId/edit",
      params: { operationId: op.id },
    });

  const handleDeleteClick = (id: string) => () => void handleDelete(id);

  const handleExportOperation = (op: OperationRecord) => () => exportOperation(op);

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    const text = await file.text();
    const parseResult = safeJsonParse<Partial<OperationRecord>>(text);
    if (parseResult.isErr()) {
      addToast({
        type: "error",
        title: t("common.import"),
        description: t("errors.networkError"),
      });
      setImporting(false);
      e.target.value = "";

      return;
    }
    const parsed = parseResult.value;
    if (!parsed.name || typeof parsed.name !== "string" || !parsed.name.trim()) {
      addToast({
        type: "error",
        title: t("common.import"),
        description: `JSON ${t("validation.nameRequired")}`,
      });
      setImporting(false);
      e.target.value = "";

      return;
    }
    const result = await createOpMutate({
      resource: ResourceName.operations,
      values: {
        id: `op-${Date.now()}`,
        name: parsed.name,
        description: parsed.description ?? null,
        config: parsed.config ?? "{}",
        acceptedObjectTypes: parsed.acceptedObjectTypes ?? ["file", "folder", "project"],
      },
    });
    const created = result.data;
    if (created) {
      addToast({
        type: "success",
        title: t("common.import"),
        description: `${t("operations.createNew")} ${parsed.name}`,
      });
    }
    setImporting(false);
    e.target.value = "";
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
        <div>
          <h1 className="text-base font-semibold text-foreground">{t("operations.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("operations.noOperations")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={importing} size="sm" variant="outline" onClick={handleImportClick}>
            <Upload className="h-4 w-4" />
            {importing ? t("common.loading") : t("common.import")}
          </Button>
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4" />
            {t("operations.createNew")}
          </Button>
        </div>
        <input
          ref={importInputRef}
          accept=".json,application/json"
          className="hidden"
          type="file"
          onChange={handleImportFile}
        />
      </div>

      {/* Search + filter bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-6 py-3">
        <div className="relative ml-auto max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder={t("operations.searchPlaceholder")}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        <label className="sr-only" htmlFor="sort-select">
          {t("common.actions")}
        </label>
        <Select
          open={sortOpen}
          value={sortBy}
          onOpenChange={handleSortOpenChange}
          onValueChange={handleSortChange}
        >
          <SelectTrigger
            aria-label={t("common.actions")}
            className="h-8 w-40 text-xs"
            id="sort-select"
            onClick={handleSortToggle}
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
        <span className="text-xs text-muted-foreground">{filteredOperations.length}</span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Operation list */}
        {filteredOperations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Zap className="h-6 w-6 text-muted-foreground" />
            </div>
            {searchQuery.trim() ? (
              <p className="text-sm font-medium text-muted-foreground">{t("common.notFound")}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("operations.noOperations")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">{t("operations.createNew")}</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filteredOperations.map((op) => (
              <div
                key={op.id}
                className="group relative rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{op.name}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link
                      className="rounded p-1 hover:bg-accent"
                      params={{ operationId: op.id }}
                      title="查看详情"
                      to="/operations/$operationId"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                    <button
                      className="rounded p-1 hover:bg-accent"
                      title="编辑"
                      onClick={handleEditClick(op)}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      className="rounded p-1 hover:bg-accent"
                      title="导出"
                      onClick={handleExportOperation(op)}
                    >
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      className="rounded p-1 hover:bg-destructive/10"
                      title="删除"
                      onClick={handleDeleteClick(op.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
                {op.description && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {op.description}
                  </p>
                )}
                {/* Show accepted object types */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {t("operations.acceptedObjectTypes")}:
                  </span>
                  <div className="flex gap-1">
                    {(Array.isArray(op.acceptedObjectTypes)
                      ? op.acceptedObjectTypes
                      : ["file", "folder", "project"]
                    ).map((type) => {
                      const config = OBJECT_TYPE_OPTIONS.find((o) => o.value === type);
                      if (!config) return null;
                      const Icon = config.icon;

                      return (
                        <span
                          key={type}
                          className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          title={config.label}
                        >
                          <Icon className="h-3 w-3" />
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
