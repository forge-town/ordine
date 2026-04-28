import { useNavigate } from "@tanstack/react-router";
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

import { useDelete } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { exportOperation } from "../exportOperation";

const handleStopPropagation = (e: React.MouseEvent) => e.stopPropagation();

interface OperationListRowProps {
  operation: Operation;
}

export const OperationListRow = ({ operation }: OperationListRowProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutate: deleteOpMutate } = useDelete();

  const handleEdit = () =>
    navigate({ to: "/operations/$operationId/edit", params: { operationId: operation.id } });
  const handleDelete = () =>
    deleteOpMutate({ resource: ResourceName.operations, id: operation.id });
  const handleExport = () => exportOperation(operation);
  const complexity = getComplexity(operation);
  const objectTypes = Array.isArray(operation.acceptedObjectTypes)
    ? operation.acceptedObjectTypes
    : (["file", "folder", "project"] as ObjectType[]);

  const handleRowClick = () => {
    navigate({
      to: "/operations/$operationId",
      params: { operationId: operation.id },
    });
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleRowClick();
  };

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Zap className="h-3.5 w-3.5 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{operation.name}</p>
      </div>

      <p className="hidden md:block min-w-0 max-w-xs text-xs text-muted-foreground truncate">
        {operation.description ?? "—"}
      </p>

      <div className="hidden sm:flex gap-1 shrink-0">
        {objectTypes.map((type) => {
          const Icon = OBJECT_TYPE_ICONS[type];
          if (!Icon) return null;

          return (
            <span
              key={type}
              className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5"
              title={type}
            >
              <Icon className="h-3 w-3 text-muted-foreground" />
            </span>
          );
        })}
      </div>

      {complexity > 0 && (
        <div className="hidden sm:flex items-center gap-0.5 shrink-0" title={`${complexity} ports`}>
          {Array.from({ length: Math.min(complexity, 5) }).map((_, i) => (
            <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary/60" />
          ))}
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger onClick={handleStopPropagation}>
          <Button className="h-7 w-7 shrink-0" size="icon" variant="ghost">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={handleStopPropagation}>
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
  );
};
