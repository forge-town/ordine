import { Link } from "@tanstack/react-router";
import {
  Zap,
  FileCode,
  Folder,
  FolderGit2,
  MoreHorizontal,
  Pencil,
  Download,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Operation, ObjectType } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";

const OBJECT_TYPE_ICONS: Record<ObjectType, React.ElementType> = {
  file: FileCode,
  folder: Folder,
  project: FolderGit2,
};

const getComplexity = (op: Operation) => {
  const config = op.config;
  if (!config) return 0;
  const inputs = Array.isArray(config.inputs) ? config.inputs.length : 0;
  const outputs = Array.isArray(config.outputs) ? config.outputs.length : 0;

  return inputs + outputs;
};

interface OperationCardProps {
  operation: Operation;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
}

export const OperationCard = ({ operation, onEdit, onDelete, onExport }: OperationCardProps) => {
  const { t } = useTranslation();
  const handleEdit = onEdit;
  const handleDelete = onDelete;
  const handleExport = onExport;
  const handlePreventDefault = (e: React.MouseEvent) => e.preventDefault();
  const complexity = getComplexity(operation);
  const objectTypes = Array.isArray(operation.acceptedObjectTypes)
    ? operation.acceptedObjectTypes
    : (["file", "folder", "project"] as ObjectType[]);

  return (
    <Link
      className="group relative flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/50"
      params={{ operationId: operation.id }}
      to="/operations/$operationId"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground leading-tight">{operation.name}</h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger onClick={handlePreventDefault}>
            <Button
              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={handlePreventDefault}>
            <DropdownMenuItem title={t("common.edit")} onClick={handleEdit}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              {t("common.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExport}>
              <Download className="mr-2 h-3.5 w-3.5" />
              {t("common.export")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {operation.description && (
        <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {operation.description}
        </p>
      )}

      <div className="mt-auto pt-4 flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {objectTypes.map((type) => {
            const Icon = OBJECT_TYPE_ICONS[type];
            if (!Icon) return null;

            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                <Icon className="h-3 w-3" />
                {type}
              </span>
            );
          })}
        </div>
        {complexity > 0 && (
          <div className="flex items-center gap-0.5" title={`${complexity} ports`}>
            {Array.from({ length: Math.min(complexity, 5) }).map((_, i) => (
              <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary/60" />
            ))}
            {complexity > 5 && (
              <span className="text-[10px] text-muted-foreground ml-0.5">+{complexity - 5}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
};
